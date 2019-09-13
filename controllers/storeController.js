const mongoose = require("mongoose");
const Store = mongoose.model("Store");
const User = mongoose.model("User");
const multer = require("multer"); // image upload package.
const jimp = require("jimp"); // image resizing package
const uuid = require("uuid"); //unique identifier package

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith("image/");
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: "That filetype isn`'`t allowed!" }, false);
    }
  }
};

exports.homePage = (req, res) => {
  res.render("index");
};

exports.addStore = (req, res) => {
  res.render("editStore", { title: "Add Store" });
};

// reads the image into memory, ready for resizing. This is temporary.
exports.upload = multer(multerOptions).single("photo");

// save image, record file name, create store.
exports.resize = async (req, res, next) => {
  // check if there is no new file to resize
  if (!req.file) {
    next(); // skip to the next middleware
    return;
  }
  const extension = req.file.mimetype.split("/")[1]; // give me the extention of the mimetype after the slash symbol
  req.body.photo = `${uuid.v4()}.${extension}`; // use uuid to name the file uniquely
  // now we resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  // once we have written the photo to file system, keep going!
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await new Store(req.body).save();
  req.flash(
    "success",
    `Successfully Created ${store.name}. Care to leave a review?`
  );
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = page * limit - limit;

  // 1. Query database for a list of all stores.
  const storesPromise = Store.find()
    .skip(skip)
    .limit(limit)
    .sort({ created: "desc" });

  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);

  const pages = Math.ceil(count / limit);

  // if you try to go to a page that does not exist.
  if (!stores.length && skip) {
    req.flash(
      "info",
      `Hey! You asked for page ${page} but that does not exist. Therefore you are sent to page ${pages}`
    );
    res.redirect(`/stores/page/${pages}`);
  }

  res.render("stores", {
    title: "Stores",
    stores: stores,
    page: page,
    pages: pages,
    count: count
  });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error("You must own a store in order to edit it!");
  }
};

exports.editStore = async (req, res) => {
  // 1. Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2. Confirm they are the owner of the store
  confirmOwner(store, req.user);
  // 3. Render out the edit form so the user can update their store.
  res.render("editStore", { title: `Edit ${store.name}`, store: store });
};

exports.updateStore = async (req, res) => {
  // set the location data to be a point
  req.body.location.type = "Point";
  // find and update the store
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, //return the new store instead of old one.
    runValidators: true
  }).exec();
  req.flash(
    "success",
    `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View Store</a>`
  );
  // Redirect them to the store and tell them it worked.
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
  //res.json(req.params);
  const store = await Store.findOne({ slug: req.params.slug }).populate(
    "author reviews"
  );
  //res.json(store); displays data
  if (!store) return next(); // if the store does not exist, then return 404.
  res.render("store", { store: store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
  //res.send("it works"); //test it out
  const tag = req.params.tag; // pull out the params of the tag you are on.
  //res.json(tags);
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  //res.json(stores);
  res.render("tag", { tags: tags, title: "Tags", tag: tag, stores: stores });
};

exports.searchStores = async (req, res) => {
  const stores = await Store
    // find stores that match
    .find(
      {
        $text: {
          $search: req.query.q
        }
      },
      {
        score: { $meta: "textScore" }
      }
    )
    // then sort them
    .sort({
      score: { $meta: "textScore" }
    })
    // limit to only 5 results
    .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: coordinates
        },
        $maxDistance: 10000 // 10 kilometers
      }
    }
  };

  const stores = await Store.find(q)
    .select("slug name description location photo")
    .limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render("map", { title: "Map" });
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  const operator = hearts.includes(req.params.id) ? "$pull" : "$addToSet";
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { [operator]: { hearts: req.params.id } },
    { new: true }
  );
  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts }
  });
  res.render("stores", { title: "Hearted Stores", stores: stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  //res.json(stores);
  res.render("topStores", { stores: stores, title: "Top Stores." });
};
