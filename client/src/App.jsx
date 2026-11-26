import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
async function request(path, options = {}) {
  const response = await fetch(API + path, {
    ...options, credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong");
  return data;
}
function Header({ user, onLogout }) {
  return <header className="header"><Link className="brand" to="/">learn<span>hub.</span></Link>
    <nav><NavLink to="/">Explore</NavLink>{user && <NavLink to="/dashboard">Dashboard</NavLink>}
      {user?.role === "admin" && <NavLink to="/admin">Manage</NavLink>}</nav>
    <div className="nav-actions">{user ? <><span className="welcome">Hi, {user.name.split(" ")[0]}</span><button className="btn btn-quiet" onClick={onLogout}>Log out</button></> :
      <><Link className="login-link" to="/login">Log in</Link><Link className="btn btn-primary" to="/register">Get started</Link></>}</div>
  </header>;
}
function Footer() { return <footer>© {new Date().getFullYear()} LearnHub <span>Build skills. Move forward.</span></footer>; }
function CourseCard({ course }) {
  return <article className="course-card"><div className="course-art"><span>{course.category || "Learning"}</span><b>{(course.title || "C").slice(0,1).toUpperCase()}</b></div>
    <div className="course-body"><div className="course-meta">{course.level || "All levels"} · {course.lessons?.length || 0} lessons</div>
      <h3>{course.title}</h3><p>{course.description}</p><div className="course-bottom"><strong>{course.price ? "₹" + course.price : "Free"}</strong><Link to={"/courses/" + course._id}>View course <span>→</span></Link></div></div></article>;
}
function Home() {
  const [courses,setCourses] = useState([]), [loading,setLoading] = useState(true), [error,setError] = useState("");
  useEffect(() => { request("/courses").then(d=>setCourses(d.courses)).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[]);
  return <><section className="hero"><div className="hero-copy"><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>Learn skills.<br/><em>Shape your future.</em></h1><p>Practical courses, clear learning paths, and progress you can actually see. Make time for the skills that move you forward.</p><div className="hero-actions"><a className="btn btn-primary" href="#courses">Explore courses <span>→</span></a><Link className="btn btn-outline" to="/register">Join for free</Link></div><div className="hero-note"><span className="note-dot"/> Learn at your own pace, from anywhere</div></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="learning-card"><div className="card-top"><span>✳ Learning path</span><span className="live-pill">● LIVE</span></div><div className="book-icon">✦</div><h3>Small steps.<br/>Big progress.</h3><div className="progress-label"><span>Your momentum</span><b>72%</b></div><div className="progress-track"><i/></div><div className="mini-tags"><span>Focus</span><span>Practice</span><span>Grow</span></div></div><div className="float-chip chip-top">✦ Keep growing</div><div className="float-chip chip-bottom">↗ Skills that matter</div></div></section>
    <section className="stats"><div><b>01</b><span>Learn on your schedule</span></div><div><b>02</b><span>Track every milestone</span></div><div><b>03</b><span>Build real-world skills</span></div></section>
    <section className="section" id="courses"><div className="section-heading"><div><span className="eyebrow">THE CLASSROOM</span><h2>Find your next <em>skill.</em></h2></div><p>Thoughtfully structured courses to help you move from curious to confident.</p></div>
      {loading ? <p className="state">Loading courses…</p> : error ? <p className="error">{error}</p> : courses.length ? <div className="course-grid">{courses.map(c=><CourseCard key={c._id} course={c}/>)}</div> : <div className="empty"><div>✳</div><h3>Something great is being created.</h3><p>New courses are on the way. Check back soon.</p></div>}</section></>;
}
function Auth({ mode, onAuth }) {
  const [form,setForm] = useState({name:"",email:"",password:""}), [error,setError] = useState(""), [busy,setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e) { e.preventDefault(); setBusy(true); setError(""); try { const d=await request("/auth/"+mode,{method:"POST",body:JSON.stringify(form)}); onAuth(d.user); navigate("/dashboard"); } catch(err) { setError(err.message); } finally { setBusy(false); } }
  return <main className="auth-wrap"><div className="auth-aside"><span className="eyebrow">A BETTER WAY TO LEARN</span><h1>Make your<br/><em>next move.</em></h1><p>Every expert started somewhere. Start here, and keep moving forward.</p><div className="auth-mark">✳</div></div><form className="auth-form" onSubmit={submit}><span className="eyebrow">{mode==="login"?"WELCOME BACK":"START LEARNING"}</span><h2>{mode==="login"?"Good to see you.":"Create your account."}</h2><p>{mode==="login"?"Sign in to continue your learning journey.":"Join LearnHub and start building your skills."}</p>
    {mode==="register" && <label>Full name<input required minLength="2" maxLength="80" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name"/></label>}
    <label>Email address<input type="email" required maxLength="254" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label>
    <label>Password<input type="password" required minLength={mode==="register"?8:1} maxLength="72" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={mode==="register"?"At least 8 characters":"Your password"}/></label>
    {error && <div className="form-error" role="alert">{error}</div>}<button className="btn btn-primary submit-btn" disabled={busy}>{busy?"Please wait…":mode==="login"?"Log in":"Create account"}</button>
    <div className="switch-auth">{mode==="login"?"New to LearnHub?":"Already have an account?"} <Link to={mode==="login"?"/register":"/login"}>{mode==="login"?"Create an account":"Log in"}</Link></div></form></main>;
}
function CourseDetail({ user }) {
  const {id}=useParams(), navigate=useNavigate(), [course,setCourse]=useState(null), [error,setError]=useState("");
  useEffect(()=>{request("/courses/"+id).then(d=>setCourse(d.course)).catch(e=>setError(e.message));},[id]);
  async function enroll(){ if(!user){navigate("/login");return;} try{await request("/courses/"+id+"/enroll",{method:"POST"});navigate("/dashboard");}catch(e){setError(e.message);} }
  if(error)return <main className="page"><p className="error">{error}</p></main>;
  if(!course)return <main className="page state">Loading course…</main>;
  return <main className="detail page"><Link className="back-link" to="/">← All courses</Link><div className="detail-grid"><div><span className="eyebrow">{course.category || "COURSE"} · {course.level || "ALL LEVELS"}</span><h1>{course.title}</h1><p className="detail-desc">{course.description}</p><h2>What you'll learn</h2><div className="lesson-list">{course.lessons.map((l,i)=><div key={l._id||i}><span>{String(i+1).padStart(2,"0")}</span>{l.title}</div>)}</div></div><aside className="enroll-panel"><div className="panel-art">✳</div><h3>{course.title}</h3><p>{course.lessons.length} lessons · Learn at your own pace</p><strong>{course.price?"₹"+course.price:"Free"}</strong><button className="btn btn-primary submit-btn" onClick={enroll}>{user?"Enroll now":"Log in to enroll"}</button></aside></div></main>;
}
function Dashboard({ user }) {
  const [items,setItems]=useState([]),[error,setError]=useState(""),[busy,setBusy]=useState("");
  async function load(){try{const d=await request(user.role==="admin"?"/courses":"/enrollments/me");setItems(user.role==="admin"?d.courses:d.enrollments);}catch(e){setError(e.message);}}
  useEffect(()=>{load();},[]);
  async function complete(enrollment,lesson){setBusy(lesson._id);try{await request("/enrollments/"+enrollment._id+"/lessons/"+lesson._id,{method:"PATCH",body:JSON.stringify({completed:true})});await load();}catch(e){setError(e.message);}finally{setBusy("");}}
  return <main className="page dashboard"><span className="eyebrow">YOUR LEARNING SPACE</span><h1>{user.role==="admin"?"Course overview": "Welcome back, "+user.name.split(" ")[0]+"."}</h1><p className="muted">{user.role==="admin"?"Manage your published learning content.":"Pick up where you left off and keep your momentum."}</p>
    {error&&<p className="error">{error}</p>}
    {user.role==="admin"?<><div className="dash-toolbar"><h2>Courses</h2><Link className="btn btn-primary" to="/admin">Manage courses →</Link></div><div className="course-grid">{items.map(c=><CourseCard key={c._id} course={c}/>)}</div></>:
      items.length?<div className="enrollment-list">{items.map(en=>{const done=en.progress?.filter(p=>p.completed).length||0;return <article className="enrollment" key={en._id}><div className="enroll-head"><div><span className="eyebrow">{en.course?.category||"COURSE"}</span><h3>{en.course?.title||"Course"}</h3></div><b>{en.course?.lessons?.length?Math.round(done/en.course.lessons.length*100):0}%</b></div><div className="progress-track"><i style={{width:(en.course?.lessons?.length?done/en.course.lessons.length*100:0)+"%"}}/></div><div className="lesson-list">{(en.course?.lessons||[]).map(l=><div key={l._id}><span>{en.progress?.some(p=>p.lessonId===l._id&&p.completed)?"✓":"○"}</span>{l.title}{!en.progress?.some(p=>p.lessonId===l._id&&p.completed)&&<button disabled={!!busy} onClick={()=>complete(en,l)}>{busy===l._id?"Saving…":"Mark complete"}</button>}</div>)}</div></article>;})}</div>:<div className="empty"><div>✳</div><h3>Your learning journey starts here.</h3><p>Explore the course library and enroll in your first course.</p><Link className="btn btn-primary" to="/">Explore courses</Link></div>}
  </main>;
}
function Admin({user}) {
  const [courses,setCourses]=useState([]),[form,setForm]=useState({title:"",description:"",category:"Development",level:"Beginner",price:0,lessons:""}),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const load=()=>request("/courses").then(d=>setCourses(d.courses)).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  async function create(e){e.preventDefault();setBusy(true);setError("");try{await request("/courses",{method:"POST",body:JSON.stringify({...form,price:Number(form.price),lessons:form.lessons.split("\n").map(x=>x.trim()).filter(Boolean).map(title=>({title}))})});setForm({title:"",description:"",category:"Development",level:"Beginner",price:0,lessons:""});load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function remove(id){if(!confirm("Delete this course? Existing enrollments will also be removed."))return;try{await request("/courses/"+id,{method:"DELETE"});load();}catch(e){setError(e.message);}}
  if(user.role!=="admin")return <main className="page"><p className="error">Administrator access required.</p></main>;
  return <main className="page admin-page"><span className="eyebrow">ADMINISTRATION</span><h1>Manage your classroom.</h1><div className="admin-grid"><form className="create-course" onSubmit={create}><h2>Publish a course</h2><label>Course title<input required maxLength="120" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Description<textarea required maxLength="1200" rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="two-fields"><label>Category<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label>Level<select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label></div><label>Price (₹)<input type="number" min="0" max="1000000" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Lessons <small>(one lesson title per line)</small><textarea required rows="5" value={form.lessons} onChange={e=>setForm({...form,lessons:e.target.value})} placeholder={"Introduction\nCore concepts\nPractical project"}/></label>{error&&<p className="error">{error}</p>}<button className="btn btn-primary submit-btn" disabled={busy}>{busy?"Publishing…":"Publish course"}</button></form><section className="manage-courses"><h2>Published courses <span>{courses.length}</span></h2>{courses.map(c=><div className="manage-row" key={c._id}><div><b>{c.title}</b><small>{c.lessons.length} lessons · {c.category}</small></div><button className="delete-btn" onClick={()=>remove(c._id)}>Delete</button></div>)}</section></div></main>;
}
export default function App(){
  const [user,setUser]=useState(null),[ready,setReady]=useState(false),navigate=useNavigate();
  useEffect(()=>{request("/auth/me").then(d=>setUser(d.user)).catch(()=>{}).finally(()=>setReady(true));},[]);
  async function logout(){try{await request("/auth/logout",{method:"POST"});}finally{setUser(null);navigate("/");}}
  if(!ready)return <div className="app-loading">learn<span>hub.</span></div>;
  return <><Header user={user} onLogout={logout}/><Routes><Route path="/" element={<Home/>}/><Route path="/login" element={<Auth mode="login" onAuth={setUser}/>}/><Route path="/register" element={<Auth mode="register" onAuth={setUser}/>}/><Route path="/courses/:id" element={<CourseDetail user={user}/>}/><Route path="/dashboard" element={user?<Dashboard user={user}/>:<Auth mode="login" onAuth={setUser}/>}/><Route path="/admin" element={user?<Admin user={user}/>:<Auth mode="login" onAuth={setUser}/>}/><Route path="*" element={<main className="page"><h1>Page not found</h1><Link to="/">Go home</Link></main>}/></Routes><Footer/></>;
}