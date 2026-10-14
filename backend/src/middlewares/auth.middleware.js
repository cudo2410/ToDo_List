const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Bạn cần đăng nhập để thực hiện thao tác này.',
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: String(payload.userId),
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Token không hợp lệ hoặc đã hết hạn.',
    });
  }
};

module.exports = authenticateToken;
