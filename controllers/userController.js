const mongoose = require('mongoose');
const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/userModel');
const Post = require('../models/postModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const slugify = require('slugify');

// documents upload
const multerStorageDocument = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/documents');
  },
  filename: (req, file, cb) => {
    // user-userID-currentTimeStamp-fileExtension
    const ext = file.originalname.split('.')[1];
    let name = '';
    if (ext) {

      name = `userCV-${req.user.id}-${Date.now()}.${ext}`;
    }
    else {
      name = `userCV-${req.user.id}-${Date.now()}`;
    }
    cb(null, name);
  }
});

// document filter 
const multerDocumentFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('application')) {
    cb(null, true)
  } else {
    cb(new AppError('Please Upload only .docx or .pptx or .pdf files'), false)
  }
}

const documentUpload = multer({
  storage: multerStorageDocument,
  fileFilter: multerDocumentFilter
})

exports.uploadUserCv = documentUpload.single('cv')

const multerStorage = multer.memoryStorage();

// to check if the uploaded file is an image
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {

    cb(new AppError('Not an image please upload only images', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
};

// Admins only
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    status: 'success',
    numUsers: users.length,
    data: {
      users,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate('posts');

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

exports.getMe = catchAsync(async (req, res, next) => {
  const currentUser = await User.findById(req.user.id);
  res.status(200).json({
    status: 'success',
    data: {
      user: currentUser,
    },
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  console.log(req.file);
  const user = await User.findById(req.user.id).select('+password');
  if (req.file) req.body.photo = req.file.filename;
  if (req.body.password) {
    if (!(await user.correctPassword(req.body.password, user.password))) {
      return next(new AppError('Current Password is not Correct!', 400));
    } else {
      user.password = req.body.newPassword;
      user.passwordConfirm = req.body.newPasswordConfirm;
    }
  }
  if (req.body.name) {
    req.body.slug = slugify(req.body.name, { lower: true });
  }
  const updatedUser = await User.findByIdAndUpdate(req.user.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

// for Admins Only
exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'user updated',
    data: {
      user,
    },
  });
});

// Admins only
exports.deleteUser = catchAsync(async (req, res, next) => {
  await User.findByIdAndDelete(req.params.id);
  res.status(200).json({
    data: null,
  });
});

// main operations

exports.getFeed = catchAsync(async (req, res, next) => {
  const currentUser = await User.findById(req.user.id).populate('following');
  const feed1 = [];
  const usersPosts = currentUser.following.map((user) => {
    if (user.posts.length > 0) {
      // without this condition it would add empty arrays to feed1
      // that causes the query to get all the documents
      // and hence the duplicated posts appear
      feed1.unshift(user.posts);
    }
  });

  const f = [].concat(...feed1);
  // it didnt work last time because the array that was passed
  // in 'in()' method was not flat

  // this is getting posts from followed users
  const feed = await Post.find()
    .where('_id')
    .in(f)
    .populate('user')
    .sort('-createdAt')
    .exec();

  // now we have to get the posts that their tags are included
  // in the interests array of the user
  // how am I gonna do that , I dont know
  // it works lol :)
  const feed2 = await Post.find()
    .where('tag')
    .in(currentUser.interests)
    .where('user')
    .nin(currentUser.following)
    .populate('user')
    .sort('-createdAt')
    .exec();

  let arr2 = [];
  feed2.forEach((post) => {
    if (!arr2.includes(post)) {
      arr2.push(post);
    }
  });
  //console.log(arr2);
  // now merge it with the feed array
  // and remove the duplicates
  const newFeed = [].concat(...feed, feed2);
  let arr = [];
  newFeed.forEach((post) => {
    if (!arr.includes(post)) {
      arr.push(post);
    }
  });

  // have to sort the new array
  // for (let i = 0; i < arr.length; i++) {
  //   console.log(arr[i].createdAt);
  // }

  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      if (arr[i].createdAt > arr[j].createdAt) {
        let m;
        m = arr[i];
        arr[i] = arr[j];
        arr[j] = m;
      }
    }
  }

  req.feed = arr;
  next();
});

exports.getSuggestions = catchAsync(async (req, res, next) => {
  const currentUser = await User.findById(req.user.id);
  const { following, followers } = currentUser;
  const populatedFollowing = await User.find()
    .where('_id')
    .in(following)
    .exec();
  const populatedFollowers = await User.find()
    .where('_id')
    .in(followers)
    .exec();
  //console.log(populatedFollowing);
  const arr = [];
  const r = populatedFollowing.map((user) => arr.unshift(user.following));
  const arr2 = [];
  const r2 = populatedFollowers.map((user) => arr2.unshift(user.followers));
  //console.log(arr);
  const flatten = [].concat(...arr, ...arr2);
  // filter the users that I'm already following
  // concat the flatten and following array
  // and then remove the duplicate and passed it to the query
  let filteredFlatten = [];
  flatten.map((x) => {
    if (
      !currentUser.following.includes(x) &&
      x.toString() !== currentUser.id.toString()
    ) {
      filteredFlatten.unshift(x);
    }
  });
  //const removeIndex = filteredFlatten.indexOf(currentUser._id);
  // if (removeIndex !== -1) {
  //   filteredFlatten.splice(removeIndex, 1);
  // }
  //console.log(removeIndex);

  const suggested = await User.find()
    .where('_id')
    .in(filteredFlatten)
    .select('name photo skills slug')
    .exec();

  req.suggestions = suggested;
  next();
});

exports.followUser = catchAsync(async (req, res, next) => {
  // 1) get current user
  const currentUser = await User.findById(req.user.id);
  const stringIDs = currentUser.following.map((id) => id.toString());
  if (stringIDs.includes(req.params.user)) {
    return next(new AppError('You are already following this user', 401));
  }
  const userID = mongoose.Types.ObjectId(req.params.user);
  currentUser.following.unshift(userID);
  const followedUser = await User.findById(req.params.user);
  followedUser.followers.unshift(mongoose.Types.ObjectId(req.user.id));
  await currentUser.save({ validateBeforeSave: false });
  await followedUser.save({ validateBeforeSave: false });
  res.status(200).json({
    status: 'success',
    data: {
      following: currentUser.following,
      userName: followedUser.name,
    },
  });
});

exports.unfollowUser = catchAsync(async (req, res, next) => {
  const currentUser = await User.findById(req.user.id);
  const unfollowedUser = await User.findById(req.params.user);
  if (!currentUser.following.includes(unfollowedUser.id)) {
    return next(new AppError('You Are not following this user', 401));
  }
  // remove the unfollowed user ID from the following array of the current user
  const removeIndex = currentUser.following.indexOf(unfollowedUser.id);

  currentUser.following.splice(removeIndex, 1);

  // remove the current user from the array of followers of the unfollowed user
  const removeIndex2 = unfollowedUser.followers.indexOf(currentUser.id);
  unfollowedUser.followers.splice(removeIndex2, 1);

  await currentUser.save({ validateBeforeSave: false });
  await unfollowedUser.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'user unfollowed',
  });
});

exports.search = catchAsync(async (req, res, next) => {
  const searchQuery = req.params.query;
  // regex that starts with a variable with ignoring the case
  const re = new RegExp('^' + searchQuery, 'i');

  const users = await User.find({ name: re }).select('name photo slug');

  res.status(200).json({
    status: 'success',
    data: {
      users,
    },
  });
});


exports.uploadCv = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (req.file) {
    console.log(req.file);
    user.cv = req.file.filename;
  }
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Document Uploaded'
  })
})
