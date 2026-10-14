// Decorative demo screens. These illustrations are independent of catalog projects.
export function initHubMotion() {
  const button = document.getElementById('hub-motion');
  const banner = document.querySelector('.campaign-banner');
  const track = banner.querySelector('.banner-track');
  const group = track.querySelector('.banner-group');
  // Three equal groups keep the rotated viewport covered throughout the loop.
  // Start at the middle group so the loop always has a leading and trailing copy.
  track.append(group.cloneNode(true), group.cloneNode(true));
  track.classList.add('is-loop-ready');
  const screensByMode = new Map();
  for (const canvas of banner.querySelectorAll('[data-demo]')) {
    const mode = canvas.dataset.demo;
    if (!screensByMode.has(mode)) screensByMode.set(mode, []);
    screensByMode.get(mode).push({canvas, ctx: canvas.getContext('2d')});
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false, visible = true, frame = 0, last = 0, tick = 0;
  function draw({canvas, ctx: c}, time) {
    if (!c) return;
    const mode = canvas.dataset.demo;
    const light = ['dinosaur', 'gps'].includes(mode);
    c.fillStyle = light ? '#dce7dc' : '#102528'; c.fillRect(0,0,360,270);
    c.fillStyle = light ? '#425f42' : '#bbdea6'; c.font = '24px monospace';
    c.fillText(({dinosaur:'Dinosaur',dashboard:'Mesh console',blocks:'Block stack',gps:'GPS radar'})[mode], 12, 24);
    c.fillText('▮▮▮', 306, 24);
    c.strokeStyle = light ? '#9ab399' : '#284d4c'; c.beginPath(); c.moveTo(0,35); c.lineTo(360,35); c.stroke();
    if (mode === 'dinosaur') {
      c.fillText(String(Math.floor(time * 8)).padStart(5,'0'),275,60);
      c.strokeStyle='#708a66';c.beginPath();c.moveTo(0,224);c.lineTo(360,224);c.stroke();
      const obstacle = 360 - (time * 85 % 430);
      const jump = obstacle > 50 && obstacle < 160 ? Math.sin((160-obstacle)/110*Math.PI)*65 : 0;
      c.fillStyle='#548142';
      for (const [x,y,w,h] of [[0,13,28,20],[19,0,28,24],[-8,18,15,8],[4,33,7,13],[20,31,7,15],[34,6,3,3]]) {
        c.fillStyle = w === 3 ? '#dce7dc' : '#548142';c.fillRect(66+x,178+y-jump,w,h);
      }
      c.fillStyle='#769952';c.fillRect(obstacle,193,9,31);c.fillRect(obstacle-6,200,6,8);
      c.fillText('DINO RUN · HIGH SCORE',13,255);
    } else if (mode === 'dashboard') {
      c.fillStyle='#e6f1e3';c.font='28px monospace';c.fillText('Hello, maker_',14,67);
      c.fillStyle='#8cc7ad';c.font='26px monospace';
      ['Radio    online','Nodes    07','Battery  92%','Ready to build.'].forEach((line,i)=>c.fillText(line,14,102+i*28));
      c.font='24px monospace';
      c.fillStyle='#a6e04a';c.fillRect(14,231,156,25);c.fillStyle='#102528';c.fillText('OPEN APPS',26,250);
      if (Math.floor(time*2)%2 === 0) {c.fillStyle='#d7edb4';c.fillRect(14,207,8,14);}
    } else if (mode === 'blocks') {
      c.strokeStyle='#21403f';
      for(let x=20;x<350;x+=24){c.beginPath();c.moveTo(x,42);c.lineTo(x,265);c.stroke();}
      for(let y=42;y<270;y+=24){c.beginPath();c.moveTo(20,y);c.lineTo(350,y);c.stroke();}
      const colors=['#9bd266','#58b7a5','#f0c765','#798bcc'];
      for(let row=0;row<4;row++)for(let col=0;col<12;col++)if((row*3+col)%5>1){c.fillStyle=colors[(col+row)%4];c.fillRect(21+col*24,243-row*24,21,21);}
      c.fillStyle='#a6e04a';const y=45+(time*28%125);[[0,0],[1,0],[1,1],[2,1]].forEach(([x,r])=>c.fillRect(141+x*24,y+r*24,21,21));
    } else {
      c.strokeStyle='#89a780';[35,65,95].forEach(r=>{c.beginPath();c.arc(180,151,r,0,Math.PI*2);c.stroke();});
      c.beginPath();c.moveTo(75,151);c.lineTo(285,151);c.moveTo(180,46);c.lineTo(180,256);c.stroke();
      const angle=time*.6;c.strokeStyle='#5d8e42';c.lineWidth=2;c.beginPath();c.moveTo(180,151);c.lineTo(180+95*Math.cos(angle),151+95*Math.sin(angle));c.stroke();c.lineWidth=1;
      c.fillStyle='#577e3b';[[147,109],[208,170],[122,190],[225,95]].forEach(([x,y])=>{c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();});
      c.font='24px monospace';c.fillText('SAT 08',12,64);c.fillText('GPS FIX',12,254);
    }
  }
  function drawScreens(time) {
    let phase = 0;
    for (const copies of screensByMode.values()) {
      const source = copies[0];
      draw(source, time + phase++ * 1.8);
      // Every copy of a demo shows the same frame, including at the loop seam.
      for (const copy of copies.slice(1)) copy.ctx?.drawImage(source.canvas, 0, 0);
    }
  }
  function animate(now) {
    if (now-last>=100) {tick += Math.min((now-last)/1000,.15); drawScreens(tick);last=now;}
    frame=requestAnimationFrame(animate);
  }
  function sync() {
    cancelAnimationFrame(frame);frame=0;
    const stopped=paused||reduce.matches||document.hidden;
    document.body.classList.toggle('motion-paused',stopped);
    banner.classList.toggle('motion-idle', stopped || !visible);
    button.disabled=reduce.matches;button.setAttribute('aria-pressed',String(paused||reduce.matches));
    button.textContent=reduce.matches?'Reduced motion':paused?'Resume motion ▷':'Pause motion Ⅱ';
    if(!stopped&&visible){last=performance.now();frame=requestAnimationFrame(animate);}
  }
  drawScreens(0);
  button.addEventListener('click',()=>{paused=!paused;sync();});
  reduce.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(banner);
  sync();
}
