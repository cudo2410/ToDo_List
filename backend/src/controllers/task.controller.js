const pool = require('../config/db');

const ALLOWED_STATUS = ['todo', 'in_progress', 'completed'];
const ALLOWED_PRIORITY = ['low', 'medium', 'high'];

function isValidDateOnly(value) {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// 1. Tạo công việc
const createTask = async (req, res) => {
  try {
    const {
      title,
      description = null,
      priority = 'medium',
      due_date = null,
    } = req.body;

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        message: 'Tên công việc không được để trống.',
      });
    }

    if (title.trim().length > 255) {
      return res.status(400).json({
        message: 'Tên công việc không được vượt quá 255 ký tự.',
      });
    }

    if (!ALLOWED_PRIORITY.includes(priority)) {
      return res.status(400).json({
        message: 'Mức độ ưu tiên không hợp lệ.',
      });
    }

    if (description !== null && typeof description !== 'string') {
      return res.status(400).json({
        message: 'Mô tả không hợp lệ.',
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO tasks
        (user_id, title, description, status, priority, due_date)
       VALUES (?, ?, ?, 'todo', ?, ?)`,
      [req.user.id, title.trim(), description, priority, due_date],
    );

    const [rows] = await pool.execute(
      `SELECT id, title, description, status, priority,
              due_date, created_at, updated_at
       FROM tasks
       WHERE id = ? AND user_id = ?`,
      [result.insertId, req.user.id],
    );

    return res.status(201).json({
      message: 'Tạo công việc thành công.',
      task: rows[0],
    });
  } catch (error) {
    console.error('Create task error:', error.message);

    return res.status(500).json({
      message: 'Không thể tạo công việc.',
    });
  }
};

// 2. Lấy danh sách công việc chưa bị xóa

const getTasks = async (req, res) => {
  try {
    const { status, priority, search, due_from, due_to } = req.query;

    // Phân trang
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: 'page phải >= 1; limit phải từ 1 đến 100.',
      });
    }

    // Kiểm tra bộ lọc
    if (
      status !== undefined &&
      !['todo', 'in_progress', 'completed'].includes(status)
    ) {
      return res.status(400).json({
        message: 'Trạng thái không hợp lệ.',
      });
    }

    if (
      priority !== undefined &&
      !['low', 'medium', 'high'].includes(priority)
    ) {
      return res.status(400).json({
        message: 'Mức độ ưu tiên không hợp lệ.',
      });
    }

    const isValidDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const date = new Date(`${value}T00:00:00Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (
      (due_from !== undefined && !isValidDate(due_from)) ||
      (due_to !== undefined && !isValidDate(due_to))
    ) {
      return res.status(400).json({
        message: 'Ngày lọc phải có định dạng YYYY-MM-DD.',
      });
    }

    if (due_from && due_to && due_from > due_to) {
      return res.status(400).json({
        message: 'due_from không được sau due_to.',
      });
    }

    if (
      search !== undefined &&
      (typeof search !== 'string' || search.length > 100)
    ) {
      return res.status(400).json({
        message: 'Từ khóa tìm kiếm tối đa 100 ký tự.',
      });
    }

    // Xây dựng điều kiện SQL
    const conditions = ['user_id = ?', 'deleted_at IS NULL'];

    const params = [req.user.id];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (priority) {
      conditions.push('priority = ?');
      params.push(priority);
    }

    if (search && search.trim()) {
      conditions.push('(title LIKE ? OR description LIKE ?)');
      const keyword = `%${search.trim()}%`;
      params.push(keyword, keyword);
    }

    if (due_from) {
      conditions.push('due_date >= ?');
      params.push(due_from);
    }

    if (due_to) {
      conditions.push('due_date < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(due_to);
    }

    const whereClause = conditions.join(' AND ');

    // Đếm tổng số công việc khớp điều kiện
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM tasks
       WHERE ${whereClause}`,
      params,
    );

    const total = Number(countRows[0].total);
    const offset = (page - 1) * limit;

    // Lấy dữ liệu của trang hiện tại
    const [tasks] = await pool.execute(
      `SELECT id, title, description, status, priority,
              due_date, completed_at, created_at, updated_at
       FROM tasks
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return res.status(200).json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get tasks error:', error.message);

    return res.status(500).json({
      message: 'Không thể lấy danh sách công việc.',
    });
  }
};

// 3. Lấy chi tiết một công việc
const getTaskById = async (req, res) => {
  try {
    const [tasks] = await pool.execute(
      `SELECT id, title, description, status, priority,
              due_date, completed_at, created_at, updated_at
       FROM tasks
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.user.id],
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        message: 'Không tìm thấy công việc.',
      });
    }

    return res.status(200).json({ task: tasks[0] });
  } catch (error) {
    console.error('Get task error:', error.message);

    return res.status(500).json({
      message: 'Không thể lấy công việc.',
    });
  }
};

// 4. Cập nhật công việc
const updateTask = async (req, res) => {
  try {
    const { title, description, status, priority, due_date } = req.body;

    const fields = [];
    const values = [];

    if (title !== undefined) {
      if (
        typeof title !== 'string' ||
        !title.trim() ||
        title.trim().length > 255
      ) {
        return res.status(400).json({
          message: 'Tên công việc không hợp lệ.',
        });
      }

      fields.push('title = ?');
      values.push(title.trim());
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({
          message: 'Mô tả không hợp lệ.',
        });
      }

      fields.push('description = ?');
      values.push(description);
    }

    if (status !== undefined) {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({
          message: 'Trạng thái không hợp lệ.',
        });
      }

      fields.push('status = ?');
      values.push(status);

      fields.push('completed_at = ?');
      values.push(status === 'completed' ? new Date() : null);
    }

    if (priority !== undefined) {
      if (!ALLOWED_PRIORITY.includes(priority)) {
        return res.status(400).json({
          message: 'Mức độ ưu tiên không hợp lệ.',
        });
      }

      fields.push('priority = ?');
      values.push(priority);
    }

    if (due_date !== undefined) {
      fields.push('due_date = ?');
      values.push(due_date);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        message: 'Không có thông tin cần cập nhật.',
      });
    }

    values.push(req.params.id, req.user.id);

    const [result] = await pool.execute(
      `UPDATE tasks
       SET ${fields.join(', ')}
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) {
      const [tasks] = await pool.execute(
        `SELECT id FROM tasks
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [req.params.id, req.user.id],
      );

      if (tasks.length === 0) {
        return res.status(404).json({
          message: 'Không tìm thấy công việc.',
        });
      }
    }

    return res.status(200).json({
      message: 'Cập nhật công việc thành công.',
    });
  } catch (error) {
    console.error('Update task error:', error.message);

    return res.status(500).json({
      message: 'Không thể cập nhật công việc.',
    });
  }
};

// 5. Xóa mềm công việc
const deleteTask = async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE tasks
       SET deleted_at = CURRENT_TIMESTAMP(3)
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Không tìm thấy công việc.',
      });
    }

    return res.status(200).json({
      message: 'Đã chuyển công việc vào Thùng rác.',
    });
  } catch (error) {
    console.error('Delete task error:', error.message);

    return res.status(500).json({
      message: 'Không thể xóa công việc.',
    });
  }
};

// 6. Xem Thùng rác
const getTrash = async (req, res) => {
  try {
    const [tasks] = await pool.execute(
      `SELECT id, title, description, status, priority,
              due_date, deleted_at
       FROM tasks
       WHERE user_id = ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [req.user.id],
    );

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Get trash error:', error.message);

    return res.status(500).json({
      message: 'Không thể lấy Thùng rác.',
    });
  }
};

// 7. Khôi phục công việc
const restoreTask = async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE tasks
       SET deleted_at = NULL
       WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [req.params.id, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Không tìm thấy công việc trong Thùng rác.',
      });
    }

    return res.status(200).json({
      message: 'Khôi phục công việc thành công.',
    });
  } catch (error) {
    console.error('Restore task error:', error.message);

    return res.status(500).json({
      message: 'Không thể khôi phục công việc.',
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTrash,
  restoreTask,
};
