const crypto = require('crypto');
const { Buffer } = require('buffer');

function validateSecret(hash, body, secret) {
    let hmac = crypto.createHmac('sha256', secret);
    let the_data = hmac.update(body);
    let gen_hmac = the_data.digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(`sha256=${gen_hmac}`), Buffer.from(hash))) {
        console.log('The hash has been validated!');
        return true;
    } else {
        console.log('The hash has not been validated...');
        return false;
    }
}

module.exports = validateSecret;