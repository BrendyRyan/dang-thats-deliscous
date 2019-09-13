const passport = require("passport");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const promisify = require("es6-promisify");
const mail = require("../handlers/mail");

exports.login = passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: "Failed Login.",
  successRedirect: "/",
  successFlash: "You are now logged in."
});

exports.logout = (req, res) => {
  req.logout();
  req.flash("success", "You are now logged out.");
  res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
  // 1. check if user is authenticated
  if (req.isAuthenticated()) {
    next(); // Carry on. They are logged in.
    return;
  }
  req.flash("error", "Oops. You must be logged in to do that.");
  res.redirect("/login");
};

exports.forgot = async (req, res) => {
  // 1. See if the user exists.
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("error", "A password reset has been emailed to you.");
    return res.redirect("/login");
  }
  // 2. Set the reset token and expiry on the account
  user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  user.resetPasswordExpires = Date.now() + 3600000; // one hour from now.
  await user.save();
  // 3. Send them an email with the token.
  const resetURL = `http://${req.headers.host}/account/reset/${
    user.resetPasswordToken
  }`;
  await mail.send({
    user: user,
    subject: "Password Reset",
    resetURL: resetURL,
    filename: "password-reset"
  });
  req.flash("success", `You have been emailed a password reset link.`);
  // 4. Redirect to login page after email token has been sent.
  res.redirect("/login");
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    return res.redirect("/login");
  }
  // if there is a user, show the reset password form.
  res.render("reset", { title: "Reset your Password" });
};

exports.confirmedPasswords = (req, res, next) => {
  // if there is a dash in a name, wrap in square brackets to get it to read properly.
  if (req.body.password === req.body["password-confirm"]) {
    next(); // keep it going
    return;
  }
  req.flash("error", "Passwords do not match.");
  res.redirect("back");
};

exports.update = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    return res.redirect("/login");
  }
  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();
  await req.login(updatedUser);
  req.flash("success", "Your password has been reset. You are now logged in.");
  res.redirect("/");
};
