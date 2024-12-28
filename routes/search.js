const searchController = require("../controllers/searchController");
const middleware = require("../middleware");

const router = require("express").Router();

router.post('/search', middleware.verifyToken, searchController.searchPostsAndUsers)

module.exports = router;