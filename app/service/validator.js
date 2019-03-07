var Validator = require('validatorjs');

// custom validation
Validator.register('alpha_username', function (value, requirement, attribute) {
    return value.match(/^[a-zA-Z0-9._-]+$/);
}, 'username is not in proper format');

Validator.register('alpha_spaces', function (value, requirement, attribute) {
    return value.match(/(^[A-Za-z ]+$)+/);
}, 'username is not in proper format');

Validator.register('date', function (value, requirement, attribute) {
    return value.match(/^\d{4}([./-])\d{2}\1\d{2}$/);
}, 'date is not in proper format');

Validator.register('some_special_chars', function (value, requirement, attribute) {
    return value.match(/^[ A-Za-z0-9()\[\]%_,@./#&+-]*$/);
}, 'not in proper format');

Validator.register('push_token', function (value, requirement, attribute) {
    return value.match(/^[a-zA-Z0-9.:_-]+$/);
}, 'push_token is not in proper format');

Validator.register('validate_user_type', function (value, requirement, attribute) {
    requirement = [1, 2, 3];
    return requirement.indexOf(value) > -1;
}, 'invalid user type');

Validator.register('JSON', function (value, requirement, attribute) {
    try {
        var o = JSON.parse(value);
        if (o && typeof o === "object" && o !== null) {
            return true;
        }
        return false;
    }
    catch (e) {
        return false;
    }

    return false;
}, 'not a valid JSON');

Validator.register('match', function (value, requirement, attribute) {
    if (value == requirement) {
        return true;
    }
    return false;
}, ':attribute doesn\'t match');
Validator.register('telephone', function(value, requirement, attribute) { 
    return value.match(/^\d{3}-\d{3}-\d{4}$/);
}, 'The :attribute phone number is not in the format XXX-XXX-XXXX.');
module.exports = Validator;