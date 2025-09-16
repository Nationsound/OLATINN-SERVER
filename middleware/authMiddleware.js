const jwt = require("jsonwebtoken");
const User = require("../models/authScema");
const Admin = require("../models/adminSchema");

// Middleware generator
const verifyToken = (Model, keyName, forbiddenMessage) => async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const entity = await Model.findById(decoded.id).select("-password");
      if (!entity) {
        return forbiddenMessage
          ? res.status(403).json({ message: forbiddenMessage })
          : res.status(401).json({ message: "Not authorized" });
      }

      req[keyName] = entity;
      next(); // ✅ continue to next middleware or route
    } catch (err) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ message: "No token, authorization denied" });
  }
};

// Middleware instances
const protect = verifyToken(User, "user");
const protectAdmin = verifyToken(Admin, "admin", "Not authorized, not admin");

module.exports = { protect, protectAdmin };
