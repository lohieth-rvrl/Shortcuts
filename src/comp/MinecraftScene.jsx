import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Full-screen voxel world that runs behind the app. Decorative only (pointer-events: none).
export default function MinecraftScene() {
  const ref = useRef(null);

  useEffect(() => {
    const T = THREE;
    const cv = ref.current;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const R = new T.WebGLRenderer({ canvas: cv, antialias: false });
    R.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    const S = new T.Scene();
    const C = new T.PerspectiveCamera(55, 1, 0.1, 200);
    S.fog = new T.Fog(0x78a7ff, 20, 48);

    const tex = (w, h, fn) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h; fn(c.getContext('2d'));
      const t = new T.CanvasTexture(c);
      t.magFilter = t.minFilter = T.NearestFilter;
      t.colorSpace = T.SRGBColorSpace;
      return t;
    };
    const noise = (b, a, ex, s = 16) => tex(s, s, (x) => {
      for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
        const v = (Math.random() - 0.5) * a;
        x.fillStyle = `rgb(${b[0] + v | 0},${b[1] + v | 0},${b[2] + v | 0})`;
        x.fillRect(i, j, 1, 1);
      }
      if (ex) ex(x);
    });
    const M = (t) => new T.MeshLambertMaterial({ map: t });
    const flat = (c, a = 14) => M(noise(c, a, null, 8));

    const dirtT = noise([134, 96, 67], 40), grassT = noise([95, 159, 53], 46);
    const grassS = noise([134, 96, 67], 40, (x) => {
      for (let i = 0; i < 16; i++) {
        const n = 3 + (Math.random() * 2 | 0);
        for (let j = 0; j < n; j++) {
          x.fillStyle = `rgb(${85 + Math.random() * 25 | 0},${150 + Math.random() * 20 | 0},50)`;
          x.fillRect(i, j, 1, 1);
        }
      }
    });
    const gMats = [grassS, grassS, grassT, dirtT, grassS, grassS].map(M);
    const dMat = M(dirtT), sMat = M(noise([125, 125, 125], 36));
    const logS = noise([102, 81, 50], 30, (x) => { x.fillStyle = 'rgba(0,0,0,.25)'; [3, 8, 12].forEach((i) => x.fillRect(i, 0, 1, 16)); });
    const logT = noise([160, 130, 80], 20, (x) => { x.strokeStyle = 'rgba(60,40,10,.5)'; x.strokeRect(3.5, 3.5, 9, 9); });
    const logM = [logS, logS, logT, logT, logS, logS].map(M);
    const leafM = M(noise([56, 120, 40], 70));
    const bg = new T.BoxGeometry(1, 1, 1), G = 0.5;
    const H = (x, z) => (Math.hypot(x, z) > 7 && Math.sin(x * 0.8) + Math.cos(z * 0.7) > 0.7 ? 1 : 0);

    const cells = [];
    for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) cells.push([x, z, H(x, z)]);
    [[gMats, 0], [dMat, -1], [sMat, -2]].forEach(([m, o]) => {
      const im = new T.InstancedMesh(bg, m, cells.length), d = new T.Object3D();
      cells.forEach((c, i) => { d.position.set(c[0], c[2] + o, c[1]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      S.add(im);
    });

    const tree = (x, z, h) => {
      const y0 = H(x, z) + G;
      for (let i = 0; i < h; i++) { const l = new T.Mesh(bg, logM); l.position.set(x, y0 + 0.5 + i, z); S.add(l); }
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy < 3; dy++) {
        const ax = Math.abs(dx), az = Math.abs(dz);
        if (dy === 2 && (ax > 1 || az > 1)) continue;
        if (dy < 2 && ax === 2 && az === 2) continue;
        if (!dx && !dz && !dy) continue;
        const l = new T.Mesh(bg, leafM); l.position.set(x + dx, y0 + h - 0.5 + dy, z + dz); S.add(l);
      }
    };
    tree(-7, 2, 4); tree(6, -6, 5); tree(-5, -7, 4); tree(7, 5, 4);

    const bx = (w, h, d, m, x, y, z, top) => {
      const g = new T.BoxGeometry(w / 16, h / 16, d / 16);
      if (top) g.translate(0, -h / 32, 0);
      const o = new T.Mesh(g, m); o.position.set(x / 16, y / 16, z / 16); return o;
    };

    // Steve-style walker
    const skin = flat([198, 134, 101]), hair = flat([60, 40, 25]), shirt = flat([0, 170, 170]), pants = flat([60, 60, 160]);
    const face = M(tex(8, 8, (x) => {
      x.fillStyle = '#c68665'; x.fillRect(0, 0, 8, 8); x.fillStyle = '#3c2819';
      x.fillRect(0, 0, 8, 2); x.fillRect(0, 2, 1, 2); x.fillRect(7, 2, 1, 2);
      x.fillStyle = '#fff'; x.fillRect(1, 4, 2, 1); x.fillRect(5, 4, 2, 1);
      x.fillStyle = '#4a3a8a'; x.fillRect(2, 4, 1, 1); x.fillRect(5, 4, 1, 1);
      x.fillStyle = '#8a4b38'; x.fillRect(3, 6, 2, 1);
    }));
    const st = { g: new T.Group() };
    st.head = bx(8, 8, 8, [skin, skin, hair, skin, face, hair], 0, 28, 0);
    st.body = bx(8, 12, 4, shirt, 0, 18, 0);
    st.aL = bx(4, 12, 4, shirt, -6, 24, 0, 1); st.aR = bx(4, 12, 4, shirt, 6, 24, 0, 1);
    st.lL = bx(4, 12, 4, pants, -2, 12, 0, 1); st.lR = bx(4, 12, 4, pants, 2, 12, 0, 1);
    st.g.add(st.head, st.body, st.aL, st.aR, st.lL, st.lR); S.add(st.g);

    // Creeper
    const cMats = [flat([70, 160, 60], 60), M(tex(8, 8, (x) => {
      x.fillStyle = '#46a03c'; x.fillRect(0, 0, 8, 8); x.fillStyle = '#000';
      [[1, 2, 2, 2], [5, 2, 2, 2], [3, 4, 2, 3], [2, 5, 1, 2], [5, 5, 1, 2]].forEach((r) => x.fillRect(...r));
    }))];
    const cg = cMats[0];
    const cr = { g: new T.Group() };
    cr.head = bx(8, 8, 8, [cg, cg, cg, cg, cMats[1], cg], 0, 22, 0);
    cr.body = bx(8, 12, 4, cg, 0, 12, 0);
    cr.legs = [[-2, 2], [2, 2], [-2, -2], [2, -2]].map((p) => bx(4, 6, 4, cg, p[0], 6, p[1], 1));
    cr.g.add(cr.head, cr.body, ...cr.legs); S.add(cr.g);

    // Sky
    const cloudM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = new T.Group();
      for (let j = 0; j < 4; j++) { const b = new T.Mesh(bg, cloudM); b.scale.set(3 + Math.random() * 2, 1, 3); b.position.set(j * 2.8, 0, Math.random() * 2); c.add(b); }
      c.position.set(-30 + Math.random() * 60, 13 + Math.random() * 3, -25 + Math.random() * 50); S.add(c); clouds.push(c);
    }
    const sun = new T.Mesh(new T.BoxGeometry(5, 5, 1), new T.MeshBasicMaterial({ color: 0xfff2a0, fog: false }));
    const moon = new T.Mesh(new T.BoxGeometry(4, 4, 1), new T.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
    S.add(sun, moon);
    const sp = [];
    for (let i = 0; i < 220; i++) { const v = new T.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(80); sp.push(v.x, v.y, v.z); }
    const starGeo = new T.BufferGeometry(); starGeo.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    const stars = new T.Points(starGeo, new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false }));
    S.add(stars);
    const amb = new T.AmbientLight(0xffffff, 1), dl = new T.DirectionalLight(0xffffff, 1); S.add(amb, dl);

    // Explosion particles
    const pg = new T.BoxGeometry(0.25, 0.25, 0.25), parts = [];
    let shake = 0;
    const boom = (p) => {
      [0x555555, 0xff9a1a, 0x333333, 0xffffff, 0xffd24d].forEach((col) => {
        for (let i = 0; i < 9; i++) {
          const m = new T.Mesh(pg, new T.MeshBasicMaterial({ color: col }));
          m.position.copy(p).add(new T.Vector3(0, 1, 0));
          m.userData = { v: new T.Vector3((Math.random() - 0.5) * 7, Math.random() * 7 + 2, (Math.random() - 0.5) * 7), life: 1.3 };
          S.add(m); parts.push(m);
        }
      });
      shake = 0.5;
    };

    let tod = 0.7, t = 0, sa = 0, th = 0.8, cs = 'chase', ct = 0;
    cr.g.position.set(-8, G, -3);
    const dayC = new T.Color(0x78a7ff), nightC = new T.Color(0x090d20), sky = new T.Color();
    const ambN = new T.Color(0x5a68c0), ambD = new T.Color(0xffffff);
    const flash = (f) => cMats.forEach((m) => m.emissive.setScalar(f));
    const respawn = () => {
      const a = Math.random() * 6.28;
      cr.g.position.set(Math.cos(a) * 9, G, Math.sin(a) * 9);
      cr.g.visible = true; cr.g.scale.set(1, 1, 1); cs = 'chase'; flash(0);
    };

    const update = (dt) => {
      t += dt; tod += dt * 0.05;
      const s = Math.sin(tod), k = Math.min(1, Math.max(0, s * 2 + 0.5));
      sun.position.set(Math.cos(tod) * 32, s * 32, 8); moon.position.set(-sun.position.x, -sun.position.y, -8);
      sun.lookAt(0, 0, 0); moon.lookAt(0, 0, 0);
      dl.position.copy(s > 0 ? sun.position : moon.position);
      dl.intensity = (0.12 + 0.9 * k) * Math.PI; amb.intensity = (0.32 + 0.4 * k) * Math.PI;
      amb.color.lerpColors(ambN, ambD, k);
      sky.copy(nightC).lerp(dayC, k); S.background = sky; S.fog.color.copy(sky);
      stars.material.opacity = 1 - k; stars.rotation.y = t * 0.01;

      sa += dt * 0.45;
      const px = Math.cos(sa) * 4.5, pz = Math.sin(sa) * 4.5, sw = Math.sin(t * 7) * 0.8;
      st.g.position.set(px, G + Math.abs(Math.sin(t * 7)) * 0.03, pz);
      st.g.rotation.y = Math.atan2(-Math.sin(sa), Math.cos(sa));
      st.aL.rotation.x = sw; st.aR.rotation.x = -sw; st.lL.rotation.x = -sw; st.lR.rotation.x = sw;
      st.head.rotation.y = Math.sin(t * 0.8) * 0.4;

      const cp = cr.g.position, dx = px - cp.x, dz = pz - cp.z, dist = Math.hypot(dx, dz);
      if (cs === 'chase') {
        cr.g.rotation.y = Math.atan2(dx, dz);
        const cw = Math.sin(t * 9) * 0.7;
        cr.legs.forEach((l, i) => { l.rotation.x = i === 0 || i === 3 ? cw : -cw; });
        if (dist > 2) { cp.x += dx / dist * 2.4 * dt; cp.z += dz / dist * 2.4 * dt; } else { cs = 'fuse'; ct = 0; }
      } else if (cs === 'fuse') {
        ct += dt; flash(Math.sin(ct * 22) > 0 ? 0.7 : 0);
        const sc = 1 + ct * 0.25; cr.g.scale.set(sc * 1.05, sc, sc * 1.05);
        cr.legs.forEach((l) => { l.rotation.x = 0; });
        if (ct > 1.5) { boom(cp); cr.g.visible = false; cs = 'dead'; ct = 0; flash(0); }
      } else { ct += dt; if (ct > 4) respawn(); }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i], u = p.userData;
        u.life -= dt; u.v.y -= 14 * dt; p.position.addScaledVector(u.v, dt);
        if (p.position.y < G + 0.12) { p.position.y = G + 0.12; u.v.multiplyScalar(0.3); }
        p.rotation.x += dt * 5; p.scale.setScalar(Math.max(0.01, u.life));
        if (u.life <= 0) { S.remove(p); p.material.dispose(); parts.splice(i, 1); }
      }
      clouds.forEach((c) => { c.position.x += dt * 0.6; if (c.position.x > 40) c.position.x = -40; });
      shake = Math.max(0, shake - dt);
      th += dt * 0.06;
    };

    const draw = () => {
      const sx = shake ? (Math.random() - 0.5) * shake * 0.3 : 0, sy = shake ? (Math.random() - 0.5) * shake * 0.3 : 0;
      C.position.set(Math.sin(th) * 15 + sx, 9 + sy, Math.cos(th) * 15);
      C.lookAt(0, 1.5, 0); R.render(S, C);
    };
    const size = () => { R.setSize(innerWidth, innerHeight, false); C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix(); draw(); };
    addEventListener('resize', size); size();

    let raf = 0, last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (!document.hidden) { update(dt); draw(); }
    };
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf); removeEventListener('resize', size);
      S.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      R.dispose();
    };
  }, []);

  return <canvas ref={ref} className="mc-scene" aria-hidden="true" />;
}
