import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";

const app = express();
const { PORT = 5000, MONGODB_URI, JWT_SECRET, ADMIN_SETUP_KEY, CLIENT_URL = "http://localhost:5173", NODE_ENV } = process.env;
if (!MONGODB_URI || !JWT_SECRET || !ADMIN_SETUP_KEY) throw new Error("MONGODB_URI, JWT_SECRET and ADMIN_SETUP_KEY must be configured");
if (JWT_SECRET.length < 32 || ADMIN_SETUP_KEY.length < 24) throw new Error("JWT_SECRET must be at least 32 characters and ADMIN_SETUP_KEY at least 24 characters");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "30kb" }));
app.use(cookieParser());

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["student", "admin"], default: "student" }
}, { timestamps: true });
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1200 },
  category: { type: String, trim: true, maxlength: 60, default: "General" },
  level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
  price: { type: Number, min: 0, max: 1000000, default: 0 },
  lessons: [{ title: { type: String, required: true, trim: true, maxlength: 160 } }],
  published: { type: Boolean, default: true }
}, { timestamps: true });
const enrollmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  progress: [{ lessonId: { type: mongoose.Schema.Types.ObjectId, required: true }, completed: { type: Boolean, default: false }, completedAt: Date }]
}, { timestamps: true });
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
const User = mongoose.model("User", userSchema);
const Course = mongoose.model("Course", courseSchema);
const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const cookieOptions = { httpOnly: true, secure: NODE_ENV === "production", sameSite: NODE_ENV === "production" ? "none" : "lax", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 };
function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("learnhub_session", token, cookieOptions);
}
function safeUser(user) { return { id: user._id, name: user.name, email: user.email, role: user.role }; }
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.learnhub_session;
    if (!token) return res.status(401).json({ message: "Please log in to continue." });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Session is no longer valid." });
    req.user = user;
    next();
  } catch { res.status(401).json({ message: "Your session has expired. Please log in again." }); }
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Administrator access required." });
  next();
}
function validId(id) { return mongoose.isValidObjectId(id); }
function handleError(err, res) {
  if (err?.code === 11000) return res.status(409).json({ message: "An account or enrollment with these details already exists." });
  if (err?.name === "ValidationError" || err?.name === "CastError") return res.status(400).json({ message: "Please check the submitted information." });
  console.error(err);
  return res.status(500).json({ message: "Server error. Please try again." });
}
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.post("/api/admin/setup", authLimiter, async (req, res) => {
  try {
    if (!req.get("x-admin-setup-key") || req.get("x-admin-setup-key") !== ADMIN_SETUP_KEY) return res.status(403).json({ message: "Invalid setup key." });
    if (await User.exists({ role: "admin" })) return res.status(409).json({ message: "An administrator has already been created." });
    const { name, email, password } = req.body;
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 80 || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 12 || password.length > 72) return res.status(400).json({ message: "Provide a valid name, email and password of 12–72 characters." });
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password: await bcrypt.hash(password, 12), role: "admin" });
    res.status(201).json({ message: "Administrator created. You can now log in.", user: safeUser(user) });
  } catch (err) { handleError(err, res); }
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 80 || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 8 || password.length > 72) return res.status(400).json({ message: "Enter a valid name, email and password (8–72 characters)." });
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password: await bcrypt.hash(password, 12), role: "student" });
    issueSession(res, user);
    res.status(201).json({ user: safeUser(user) });
  } catch (err) { handleError(err, res); }
});
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.toLowerCase().trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email }).select("+password");
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ message: "Email or password is incorrect." });
    issueSession(res, user);
    res.json({ user: safeUser(user) });
  } catch (err) { handleError(err, res); }
});
app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));
app.post("/api/auth/logout", (req, res) => { res.clearCookie("learnhub_session", { ...cookieOptions, maxAge: undefined }); res.json({ message: "Logged out." }); });

app.get("/api/courses", async (req, res) => {
  try { const courses = await Course.find({ published: true }).sort({ createdAt: -1 }).lean(); res.json({ courses }); }
  catch (err) { handleError(err, res); }
});
app.get("/api/courses/:id", async (req, res) => {
  try { if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid course ID." }); const course = await Course.findOne({ _id: req.params.id, published: true }).lean(); if (!course) return res.status(404).json({ message: "Course not found." }); res.json({ course }); }
  catch (err) { handleError(err, res); }
});
app.post("/api/courses", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, category, level, price, lessons } = req.body;
    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim() || !Array.isArray(lessons) || lessons.length < 1 || lessons.length > 100 || lessons.some(l => typeof l.title !== "string" || !l.title.trim())) return res.status(400).json({ message: "Add a title, description and at least one valid lesson." });
    const course = await Course.create({ title, description, category, level, price, lessons: lessons.map(l => ({ title: l.title.trim() })) });
    res.status(201).json({ course });
  } catch (err) { handleError(err, res); }
});
app.delete("/api/courses/:id", requireAuth, requireAdmin, async (req, res) => {
  try { if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid course ID." }); const course = await Course.findByIdAndDelete(req.params.id); if (!course) return res.status(404).json({ message: "Course not found." }); await Enrollment.deleteMany({ course: course._id }); res.json({ message: "Course deleted." }); }
  catch (err) { handleError(err, res); }
});
app.post("/api/courses/:id/enroll", requireAuth, async (req, res) => {
  try { if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid course ID." }); const course = await Course.findOne({ _id: req.params.id, published: true }); if (!course) return res.status(404).json({ message: "Course not found." }); if (course.price > 0) return res.status(400).json({ message: "Paid course checkout is not enabled yet." }); const enrollment = await Enrollment.create({ user: req.user._id, course: course._id }); res.status(201).json({ enrollment }); }
  catch (err) { handleError(err, res); }
});
app.get("/api/enrollments/me", requireAuth, async (req, res) => {
  try { const enrollments = await Enrollment.find({ user: req.user._id }).populate("course").sort({ createdAt: -1 }).lean(); res.json({ enrollments: enrollments.filter(e => e.course) }); }
  catch (err) { handleError(err, res); }
});
app.patch("/api/enrollments/:id/lessons/:lessonId", requireAuth, async (req, res) => {
  try {
    if (!validId(req.params.id) || !validId(req.params.lessonId)) return res.status(400).json({ message: "Invalid enrollment or lesson ID." });
    if (req.body.completed !== true) return res.status(400).json({ message: "Only lesson completion can be recorded." });
    const enrollment = await Enrollment.findOne({ _id: req.params.id, user: req.user._id }).populate("course");
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found." });
    if (!enrollment.course.lessons.some(l => l._id.toString() === req.params.lessonId)) return res.status(404).json({ message: "Lesson not found in this course." });
    const item = enrollment.progress.find(p => p.lessonId.toString() === req.params.lessonId);
    if (item) { item.completed = true; item.completedAt = new Date(); } else enrollment.progress.push({ lessonId: req.params.lessonId, completed: true, completedAt: new Date() });
    await enrollment.save();
    res.json({ enrollment });
  } catch (err) { handleError(err, res); }
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: "Unexpected server error." }); });
mongoose.connect(MONGODB_URI).then(() => {
  app.listen(PORT, "0.0.0.0", () => console.log("LearnHub API listening on " + PORT));
}).catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
