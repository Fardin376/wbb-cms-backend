const Gallery = require('./gallery.model');

// Add to Post schema
PostSchema.pre('remove', async function (next) {
  await Gallery.deleteMany({
    'usageTypes.isPost': true,
    'usageTypes.postId': this._id,
  });
  next();
});

// Add to Page schema
PageSchema.pre('remove', async function (next) {
  await Gallery.deleteMany({
    'usageTypes.isPage': true,
    'usageTypes.pageId': this._id,
  });
  next();
});
