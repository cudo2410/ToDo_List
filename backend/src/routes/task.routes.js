const express = require('express');
const authenticateToken = require('../middlewares/auth.middleware');

const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTrash,
  restoreTask,
} = require('../controllers/task.controller');

const router = express.Router();

// Tất cả route công việc đều yêu cầu đăng nhập
router.use(authenticateToken);

router.get('/trash', getTrash);
router.post('/', createTask);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/restore', restoreTask);

module.exports = router;
