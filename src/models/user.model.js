const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    index: { unique: true },
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'editor'],
    default: 'editor',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

//hash password
userSchema.pre('save', async function (next) {
  const user = this;
  if (!user.isModified('password')) return next();
  const hashedPassword = await bcrypt.hash(user.password, 10);
  user.password = hashedPassword;
  next();
});

//compare password for login
userSchema.methods.comparePassword = function (givenPassword) {
  return bcrypt.compare(givenPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
