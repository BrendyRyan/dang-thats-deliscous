const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const slug = require("slugs");

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: "Please enter a store name!"
    },
    slug: String,
    description: {
      type: String,
      trim: true
    },
    tags: [String],
    created: {
      type: Date,
      default: Date.now
    },
    location: {
      type: {
        type: String,
        default: "Point"
      },
      coordinates: [
        {
          type: Number,
          required: "You must supply coordinates!"
        }
      ],
      address: {
        type: String,
        required: "You must supply an address!"
      }
    },
    photo: String,
    author: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: "You must supply an author"
    }
  },
  {
    toJSON: { virtuals: true }, //bring these 'hidden' items into the json pug dumps
    toObject: { virtuals: true }
  }
);

// Define a compound text index
storeSchema.index({
  name: "text",
  description: "text"
});

// Define location as a geospatial index.
storeSchema.index({ location: "2dsphere" });

storeSchema.pre("save", async function(next) {
  if (!this.isModified("name")) {
    next(); //skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);
  // find other stores with the same name (wes, wes-1, wes-2). Incrememnt the slug to make it unique if any are found.
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, "i");
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  next();
});

// add a method onto the schema to do unique functions to it.
storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // Lookup stores and populate their reviews
    {
      $lookup: {
        from: "reviews",
        localField: "_id",
        foreignField: "store",
        as: "reviews"
      }
    },
    // filter for only items that have 2 or more reviews
    { $match: { "reviews.1": { $exists: true } } },
    // add the average reviews field
    {
      $addFields: {
        averageRating: { $avg: "$reviews.rating" }
      }
    },
    // sort it by our new field, highest reviews first
    { $sort: { averageRating: -1 } },
    // limit to at most 10
    { $limit: 10 }
  ]);
};

// find reviews where the stores _id property is === to the reviews store property.
storeSchema.virtual("reviews", {
  ref: "Review", // what model to link
  localField: "_id", // field on the store (primary key)
  foreignField: "store" // field on review (foreign key)
});

function autopopulate(next) {
  this.populate("reviews");
  next();
}

storeSchema.pre("find", autopopulate);
storeSchema.pre("findOne", autopopulate);

module.exports = mongoose.model("Store", storeSchema);
