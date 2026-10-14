const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Vui lòng nhập email và mật khẩu.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (
      normalizedEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        message: 'Email không hợp lệ.',
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: 'Mật khẩu phải dài từ 8 đến 72 ký tự.',
      });
    }

    // 2. Kiểm tra email đã tồn tại chưa
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail],
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        message: 'Email đã được sử dụng.',
      });
    }

    // 3. Băm mật khẩu trước khi lưu
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. Lưu tài khoản vào MySQL
    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash)
       VALUES (?, ?)`,
      [normalizedEmail, passwordHash],
    );

    return res.status(201).json({
      message: 'Đăng ký thành công.',
      user: {
        id: String(result.insertId),
        email: normalizedEmail,
      },
    });
  } catch (error) {
    // Xử lý trường hợp hai yêu cầu đăng ký cùng email
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Email đã được sử dụng.',
      });
    }

    console.error('Register error:', error.message);

    return res.status(500).json({
      message: 'Lỗi máy chủ khi đăng ký tài khoản.',
    });
  }
};

const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Vui lòng nhập email và mật khẩu.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [users] = await pool.execute(
      `SELECT id, email, password_hash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail],
    );

    // Không tiết lộ email nào tồn tại trong hệ thống
    if (users.length === 0) {
      return res.status(401).json({
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET chưa được cấu hình.');
    }

    const token = jwt.sign(
      { userId: String(user.id) },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
    );

    return res.status(200).json({
      message: 'Đăng nhập thành công.',
      token,
      user: {
        id: String(user.id),
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);

    return res.status(500).json({
      message: 'Lỗi máy chủ khi đăng nhập.',
    });
  }
};

const getMe = async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, email, timezone, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: 'Không tìm thấy tài khoản.',
      });
    }

    const user = users[0];

    return res.status(200).json({
      user: {
        id: String(user.id),
        email: user.email,
        timezone: user.timezone,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error.message);

    return res.status(500).json({
      message: 'Không thể lấy thông tin tài khoản.',
    });
  }
};

module.exports = { register, login, getMe };
