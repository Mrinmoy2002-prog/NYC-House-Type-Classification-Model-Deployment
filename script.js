const HOODS = {
  "Manhattan": ["Harlem","East Harlem","Upper West Side","Upper East Side","Hell's Kitchen","Midtown","Chelsea","East Village","West Village","Greenwich Village","Lower East Side","Chinatown","SoHo","Washington Heights","Financial District","Murray Hill","Gramercy","Inwood","Tribeca","Nolita"],
  "Brooklyn": ["Williamsburg","Bedford-Stuyvesant","Bushwick","Greenpoint","Crown Heights","Park Slope","Flatbush","Clinton Hill","Prospect-Lefferts Gardens","Fort Greene","Sunset Park","Carroll Gardens","DUMBO","Bay Ridge","Brooklyn Heights","Red Hook","Coney Island","Brighton Beach"],
  "Queens": ["Astoria","Long Island City","Flushing","Ridgewood","Sunnyside","Jamaica","Woodside","Forest Hills","Jackson Heights","Elmhurst","Ditmars Steinway","Rockaway Beach","Corona","Rego Park"],
  "Bronx": ["Kingsbridge","Fordham","Mott Haven","Concourse","Riverdale","Longwood","Morrisania","Port Morris","Woodlawn","Pelham Bay"],
  "Staten Island": ["St. George","Tompkinsville","Stapleton","Port Richmond","Great Kills","New Springville","Tottenville","Concord"]
};
const CENTER = {"Manhattan":[40.7831,-73.9712],"Brooklyn":[40.6782,-73.9442],"Queens":[40.7282,-73.7949],"Bronx":[40.8448,-73.8648],"Staten Island":[40.5795,-74.1502]};
const SAMPLES = [
  {g:"Manhattan",n:"Harlem",lat:40.8116,lng:-73.9465,price:149,min:3,rev:9,rpm:.45,host:1,av:340},
  {g:"Brooklyn",n:"Williamsburg",lat:40.7081,lng:-73.9571,price:85,min:2,rev:56,rpm:2.1,host:2,av:120},
  {g:"Queens",n:"Astoria",lat:40.7644,lng:-73.9235,price:45,min:1,rev:130,rpm:3.4,host:6,av:300}
];
const CLASSES = ["Entire home/apt","Private room","Shared room"]; // alphabetical, same order as model.classes_
const $ = id => document.getElementById(id);
let borough = "Manhattan", sampleIdx = 0;

// ---------- borough chips + neighbourhood list ----------
Object.keys(HOODS).forEach(b => {
  const c = document.createElement("button");
  c.type = "button"; c.className = "chip"; c.textContent = b;
  c.onclick = () => setBorough(b, true);
  $("boroughs").appendChild(c);
});
function setBorough(b, recentre) {
  borough = b;
  document.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.textContent === b));
  $("hoods").innerHTML = HOODS[b].map(h => `<option value="${h}">`).join("");
  if (recentre) { $("latitude").value = CENTER[b][0]; $("longitude").value = CENTER[b][1]; $("neighbourhood").value = ""; }
}

// ---------- sliders ----------
function paint(r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); }
function syncPrice(from) {
  if (from === "range") $("price").value = $("priceRange").value;
  else $("priceRange").value = Math.min($("price").value || 0, 1000);
  paint($("priceRange"));
}
$("priceRange").oninput = () => syncPrice("range");
$("price").oninput = () => syncPrice("num");
$("availability_365").oninput = e => { $("availOut").textContent = e.target.value + " days a year"; paint(e.target); };

// ---------- sample ----------
$("sample").onclick = () => {
  const s = SAMPLES[sampleIdx++ % SAMPLES.length];
  setBorough(s.g, false);
  Object.entries({neighbourhood:s.n,latitude:s.lat,longitude:s.lng,price:s.price,minimum_nights:s.min,number_of_reviews:s.rev,reviews_per_month:s.rpm,calculated_host_listings_count:s.host,availability_365:s.av})
    .forEach(([k,v]) => $(k).value = v);
  syncPrice("num"); $("availability_365").dispatchEvent(new Event("input"));
};

// ---------- submit ----------
const INTS = ["minimum_nights","number_of_reviews","calculated_host_listings_count","availability_365"];
const FLOATS = ["latitude","longitude","price","reviews_per_month"];
$("form").onsubmit = async e => {
  e.preventDefault();
  const err = $("error"); err.hidden = true;
  document.querySelectorAll("input.bad").forEach(i => i.classList.remove("bad"));
  const body = {neighbourhood_group: borough, neighbourhood: $("neighbourhood").value.trim()};
  FLOATS.forEach(k => body[k] = parseFloat($(k).value));
  INTS.forEach(k => body[k] = parseInt($(k).value, 10));
  const bad = Object.keys(body).filter(k => typeof body[k] === "number" ? Number.isNaN(body[k]) : !body[k]);
  if (bad.length) { bad.forEach(k => $(k)?.classList.add("bad")); return showError("Fill in the highlighted fields."); }
  if (body.price <= 0) { $("price").classList.add("bad"); return showError("Price must be above 0."); }

  const btn = $("go"); btn.classList.add("loading"); btn.querySelector(".label").textContent = "Predicting";
  try {
    const res = await fetch($("apiUrl").value.replace(/\/$/, "") + "/predict", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const msg = Array.isArray(d.detail) ? d.detail.map(x => `${x.loc.at(-1)}: ${x.msg}`).join(". ") : "The server returned an error (" + res.status + ").";
      throw new Error(msg);
    }
    render(await res.json());
  } catch (x) {
    showError(x instanceof TypeError ? "Can't reach the API. Check that uvicorn is running and the API address below is correct." : x.message);
  } finally {
    btn.classList.remove("loading"); btn.querySelector(".label").textContent = "Predict room type";
  }
};
function showError(m) { $("error").textContent = m; $("error").hidden = false; }

// ---------- result ----------
function render({Predicted_room_type: room, Probability: probs}) {
  const labels = probs.map((_, i) => CLASSES.length === probs.length ? CLASSES[i] : "Class " + (i + 1));
  const top = probs.indexOf(Math.max(...probs));
  $("idle").hidden = true; $("done").hidden = false;
  $("roomName").textContent = room;
  $("bars").innerHTML = probs.map((p, i) => `<div class="row ${i === top ? "top" : ""}"><div class="meta"><span>${labels[i]}</span><span>${(p * 100).toFixed(1)}%</span></div><div class="track-b"><div class="fill" data-w="${p * 100}"></div></div></div>`).join("");
  const pct = probs[top] * 100;
  $("ringBar").style.strokeDashoffset = 327;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $("ringBar").style.strokeDashoffset = 327 * (1 - probs[top]);
    document.querySelectorAll(".fill").forEach(f => f.style.width = f.dataset.w + "%");
  }));
  const t0 = performance.now();
  (function tick(t) { const k = Math.min((t - t0) / 1200, 1); $("pct").textContent = Math.round(pct * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); })(t0);
  if (window.innerWidth < 860) $("result").scrollIntoView({behavior:"smooth", block:"start"});
}
$("again").onclick = () => { $("done").hidden = true; $("idle").hidden = false; window.scrollTo({top:0, behavior:"smooth"}); };

// ---------- drifting night-city background ----------
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $("bg"), ctx = cv.getContext("2d"); let W, H, pts;
  const init = () => { W = cv.width = innerWidth; H = cv.height = innerHeight;
    pts = Array.from({length: Math.min(70, W / 18 | 0)}, () => ({x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.25, vy:(Math.random()-.5)*.25, r:Math.random()*1.6+.4})); };
  addEventListener("resize", init); init();
  (function loop() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach((p, i) => {
      p.x = (p.x + p.vx + W) % W; p.y = (p.y + p.vy + H) % H;
      ctx.fillStyle = i % 3 ? "#ffc46b55" : "#ff6f9166"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
      for (let j = i + 1; j < pts.length; j++) { const q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 120) { ctx.strokeStyle = `rgba(150,160,230,${.12 * (1 - d / 120)})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }
    });
    requestAnimationFrame(loop);
  })();
})();

// init
setBorough("Manhattan", true); syncPrice("num"); paint($("availability_365"));
