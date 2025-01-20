const jwt = require("jsonwebtoken");
const BlackListTokenModel = require("../models/BlackListTokenModel");

const middleware = {
    // check token đã xóa
    isTokenBlacklisted: async (token) => {
        try {
            const blacklistedToken = await BlackListTokenModel.findOne({ token });
            return !!blacklistedToken;
        } catch (err) {
            console.error('Error checking blacklisted token:', err);
            return false;
        }
    },
    verifyToken : async(req, res, next) => {
        try {
            // ACCESS TOKEN FROM HEADER
            const token = req.headers.token;
            
            if (token) {
                const isBlacklisted = await middleware.isTokenBlacklisted(token);

                if (isBlacklisted) {
                    return res.status(403).json({ message: 'Token is blacklisted' });
                }

                const accessToken = token.split(" ")[1];
                jwt.verify(accessToken, process.env.JWT_ACCESS_KEY, (err, user) => {
                    if (err) {
                        return res.status(403).json("Token is not valid!");
                    }
                    req.user = user;
                    next();
                });
            } else {
                return res.status(401).json("You're not authenticated");
            }
        } catch (error) {
            return res.status(500).json("Internal Server Error");
        }
    },

    paginatedResult: (model) => {
      return async (req, res, next) => {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);
        const byVotes = req.query.hot;
  
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
  
        const results = {};
  
        if (endIndex < (await model.countDocuments().exec())) {
          results.next = {
            page: page + 1,
            limit: limit,
          };
        }
  
        if (startIndex > 0) {
          results.previous = {
            page: page - 1,
            limit: limit,
          };
        }
        try {
          if (page && limit && byVotes) {
            results.results = await model
              .find()
              .sort({ upvotes: -1 })
              .limit(limit)
              .skip(startIndex)
              .exec();
            res.paginatedResults = results;
            next();
          } else {
            results.results = await model
              .find()
              .sort({ createdAt: -1 })
              .limit(limit)
              .skip(startIndex)
              .exec();
            res.paginatedResults = results;
            next();
          }
        } catch (e) {
          res.status(500).json({ message: e.message });
        }
      };
    },
}

module.exports = middleware;