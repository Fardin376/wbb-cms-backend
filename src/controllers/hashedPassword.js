const bcrypt = require('bcrypt');

const hashedPassword = await bcrypt.hash(password, 10);
await prisma.user.create({
  data: { username, email, password: hashedPassword, role },
});


module.exports = hashedPassword