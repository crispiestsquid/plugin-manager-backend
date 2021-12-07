const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pluginSchema = new Schema({
    name: String,
    fullName: String,
    private: Boolean,
    htmlUrl: String,
    defaultBranch: String,
    pushedAt: String,
    updatedAt: String,
    createdAt: String,
    zips: [String],
    pusherID: String
});

module.exports = mongoose.model('Plugin', pluginSchema);