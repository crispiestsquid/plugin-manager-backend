const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pusherSchema = new Schema({
    name: String,
    email: String
});

module.exports = mongoose.model('Pusher', pusherSchema);