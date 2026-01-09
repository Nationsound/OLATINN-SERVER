const jwt = require("jsonwebtoken");
const User = require("../models/authScema");
const Admin = require("../models/adminSchema");

// Middleware generator
const verifyToken = (Model, keyName, forbiddenMessage) => async (req, res, next) => {
  //Model: The Mongoose model you want to check against (e.g. User, Admin).
//keyName: The name under which the verified entity (like the user) will be attached to the req object — e.g. req.user or req.admin.
//forbiddenMessage: (optional) A custom message when access is forbidden (e.g. “Admins only”).
//This outer function returns an async middleware (the inner arrow function) that Express can use in your routes.

  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      //Checks if there’s an Authorization header and that it starts with "Bearer".
      //Splits the header value, e.g. "Bearer <token>", to extract the actual token part.
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      //Uses the secret key to verify and decode the token.
      //If invalid or expired, it jumps to the catch block

      const entity = await Model.findById(decoded.id).select("-password");
      //The decoded token usually contains { id: userId, ... }.
      //This line fetches the entity (like a user or admin) from the database using that ID.
      //.select("-password") excludes the password field from being returned.
      if (!entity) {
        return forbiddenMessage
          ? res.status(403).json({ message: forbiddenMessage })
          : res.status(401).json({ message: "Not authorized" });
      }

      req[keyName] = entity;
      //This makes the authenticated entity available in the next middleware or route handler.
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
