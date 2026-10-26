(() => {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const root = document.documentElement;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const prefersMotion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NOMBRES_CATEGORIA = {
    institucional: 'Identidad institucional',
    exposiciones: 'Exposiciones',
    editorial: 'Editorial',
    festivales: 'Festivales'
  };

  /* ---------- Tema ---------- */
  const themeButton = $('#tema');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const paintThemeIcon = () => themeButton.querySelector('use').setAttribute('href', isDark() ? '#i-sol' : '#i-luna');
  try { const saved = localStorage.getItem('jpb-tema'); if (saved) root.dataset.theme = saved; } catch (e) {}
  paintThemeIcon();
  themeButton.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('jpb-tema', root.dataset.theme); } catch (e) {}
    paintThemeIcon();
  });

  /* ---------- Menú móvil ---------- */
  const menuButton = $('#menu');
  const links = $('#links');
  const closeMenu = () => { links.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); };
  menuButton.addEventListener('click', () => menuButton.setAttribute('aria-expanded', String(links.classList.toggle('open'))));
  links.addEventListener('click', (e) => { if (e.target.tagName === 'A') closeMenu(); });

  /* ---------- Progreso de lectura y enlace activo ---------- */
  const progressBar = $('#progreso');
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  };
  addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  const navLinks = $$('.links a');
  const sectionObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('activo', a.getAttribute('href') === '#' + entry.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach((s) => sectionObserver.observe(s));

  /* ---------- Proyectos: carrusel con filtros ---------- */
  const projects = window.PROYECTOS || [];
  const track = $('#grilla');
  const carousel = $('#carrusel');
  const statusLine = $('#carrusel-estado');
  const pauseButton = $('#car-pausa');
  const chips = $$('.chip');
  const filterBar = $('.filtros');
  const indicator = $('.chip-ind');
  let visible = projects.map((p, i) => i);
  let activeFilter = 'todos';

  const coverFor = (p) => p.imagenes && p.imagenes.length
    ? `<img src="${p.imagenes[0]}" alt="${p.titulo}" loading="lazy">`
    : p.arte || '<div class="canvas c-labels"></div>';
  const cardFor = (i, isClone) => {
    const p = projects[i];
    return `
    <button class="obra${p.encuadre === 'contener' ? ' contener' : ''}" type="button" data-i="${i}"${isClone ? ' aria-hidden="true" tabindex="-1" inert' : ''} aria-label="Ver ${p.titulo}">
      <div class="arte">${coverFor(p)}<div class="image-overlay"><span>Ver proyecto</span><svg><use href="#i-flecha"/></svg></div></div>
      <div class="cap"><h3>${p.titulo}</h3><span>${p.anio}</span></div>
      <p class="meta">${p.ejemplo ? '<span class="tag-ejemplo">Ejemplo</span>' : ''}${p.institucion}</p>
      <div class="extracto"><p>${p.descripcion}</p></div>
    </button>`;
  };

  $('#aviso').hidden = !projects.some((p) => p.ejemplo);
  chips.forEach((chip) => {
    const count = chip.dataset.f === 'todos' ? projects.length : projects.filter((p) => p.categoria === chip.dataset.f).length;
    chip.hidden = count === 0;
    chip.querySelector('.chip-n').textContent = count;
  });

  /* Indicador que se desliza entre filtros */
  const moveIndicator = () => {
    const chip = chips.find((c) => c.getAttribute('aria-pressed') === 'true');
    if (!chip || !indicator) return;
    indicator.style.width = chip.offsetWidth + 'px';
    indicator.style.height = chip.offsetHeight + 'px';
    indicator.style.transform = `translate(${chip.offsetLeft}px, ${chip.offsetTop}px)`;
    filterBar.classList.add('con-ind');
  };

  /* Deriva automática */
  const SPEED = 22; // píxeles por segundo
  let position = 0;
  let loopWidth = 0;
  let userPaused = !prefersMotion;
  let hovering = false;
  let focusedInside = false;
  let onScreen = true;
  let idleUntil = 0;
  let lastFrame = 0;

  const measureLoop = () => {
    const firstClone = track.querySelector('.obra[inert]');
    const first = track.querySelector('.obra');
    loopWidth = firstClone && first ? firstClone.offsetLeft - first.offsetLeft : 0;
  };
  const isRunning = () => !userPaused && !hovering && !focusedInside && onScreen && !document.hidden &&
    loopWidth > 0 && performance.now() > idleUntil && !lightbox.classList.contains('open');

  const tick = (now) => {
    const dt = lastFrame ? Math.min(now - lastFrame, 64) / 1000 : 0;
    lastFrame = now;
    if (isRunning()) {
      if (Math.abs(track.scrollLeft - position) > 2) position = track.scrollLeft;
      position += SPEED * dt;
      if (position >= loopWidth) position -= loopWidth;
      track.scrollLeft = position;
    }
    requestAnimationFrame(tick);
  };

  const holdForInteraction = (ms = 2600) => { idleUntil = performance.now() + ms; };
  const syncPosition = () => { position = track.scrollLeft; };

  const renderCarousel = () => {
    const items = visible.map((i) => cardFor(i, false)).join('');
    track.innerHTML = items;
    const overflowing = track.scrollWidth > track.clientWidth + 40;
    if (overflowing) track.insertAdjacentHTML('beforeend', visible.map((i) => cardFor(i, true)).join(''));
    track.scrollLeft = 0;
    position = 0;
    measureLoop();
    const label = activeFilter === 'todos' ? 'Todos los proyectos' : chips.find((c) => c.dataset.f === activeFilter).firstChild.textContent;
    statusLine.textContent = `${label} · ${visible.length} ${visible.length === 1 ? 'proyecto' : 'proyectos'}`;
    if (hasGsap && prefersMotion) {
      gsap.fromTo($$('.obra', track).slice(0, 6), { x: 48, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' });
    }
  };

  const paintPauseButton = () => {
    pauseButton.querySelector('use').setAttribute('href', userPaused ? '#i-play' : '#i-pausa');
    pauseButton.setAttribute('aria-label', userPaused ? 'Reanudar el desplazamiento automático' : 'Pausar el desplazamiento automático');
  };
  pauseButton.addEventListener('click', () => { userPaused = !userPaused; syncPosition(); paintPauseButton(); });
  paintPauseButton();

  const step = (direction) => {
    const card = track.querySelector('.obra');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    if (direction < 0 && track.scrollLeft < 4 && loopWidth) track.scrollLeft += loopWidth;
    holdForInteraction(3200);
    track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: prefersMotion ? 'smooth' : 'auto' });
  };
  $('#car-prev').addEventListener('click', () => step(-1));
  $('#car-next').addEventListener('click', () => step(1));

  carousel.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
  carousel.addEventListener('pointerleave', () => { hovering = false; syncPosition(); });
  carousel.addEventListener('focusin', () => { focusedInside = true; });
  carousel.addEventListener('focusout', () => { focusedInside = carousel.contains(document.activeElement); syncPosition(); });
  ['pointerdown', 'wheel', 'touchstart'].forEach((type) => track.addEventListener(type, () => holdForInteraction(), { passive: true }));
  track.addEventListener('scroll', () => {
    if (loopWidth && track.scrollLeft >= loopWidth + 1 && !isRunning()) { track.scrollLeft -= loopWidth; }
  }, { passive: true });
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }).observe(carousel);

  chips.forEach((chip) => chip.addEventListener('click', () => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    activeFilter = chip.dataset.f;
    visible = projects.map((p, i) => i).filter((i) => activeFilter === 'todos' || projects[i].categoria === activeFilter);
    moveIndicator();
    renderCarousel();
  }));

  /* ---------- Lightbox ---------- */
  const lightbox = $('#lb');
  let current = 0;
  let lastFocus = null;
  const showImage = (p, index) => {
    $('#lb-arte').innerHTML = `<img src="${p.imagenes[index]}" alt="${p.titulo}, imagen ${index + 1} de ${p.imagenes.length}">`;
    $$('#lb-fotos button').forEach((b, i) => b.setAttribute('aria-current', String(i === index)));
  };
  const showProject = (position) => {
    current = (position + visible.length) % visible.length;
    const p = projects[visible.at(current)];
    const hasImages = p.imagenes && p.imagenes.length;
    $('#lb-tipo').textContent = `${NOMBRES_CATEGORIA[p.categoria] || ''} · ${p.anio}${p.ejemplo ? ' · Ejemplo' : ''}`;
    $('#lb-titulo').textContent = p.titulo;
    $('#lb-desc').textContent = p.descripcion;
    $('#lb-ficha').innerHTML = [['Institución', p.institucion], ['Rol', p.rol], ...(p.ficha || [])]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#lb-fotos').innerHTML = hasImages && p.imagenes.length > 1
      ? p.imagenes.map((src, k) => `<button type="button" data-k="${k}" aria-label="Imagen ${k + 1}"><img src="${src}" alt=""></button>`).join('')
      : '';
    if (hasImages) showImage(p, 0); else $('#lb-arte').innerHTML = p.arte || '';
  };
  const countProjectView = (p) => {
    if (!window.goatcounter || !window.goatcounter.count) return;
    const slug = p.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    window.goatcounter.count({ path: 'proyecto/' + slug, title: p.titulo, event: true });
  };
  const openLightbox = (i) => {
    lastFocus = document.activeElement;
    showProject(i);
    countProjectView(projects[visible.at(current)]);
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#lb-cerrar').focus();
  };
  const closeLightbox = () => {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  };
  track.addEventListener('click', (e) => {
    const card = e.target.closest('.obra');
    if (card) openLightbox(Math.max(0, visible.indexOf(Number(card.dataset.i))));
  });
  $('#lb-fotos').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showImage(projects[visible.at(current)], Number(b.dataset.k)); });
  $('#lb-cerrar').addEventListener('click', closeLightbox);
  $('#lb-prev').addEventListener('click', () => showProject(current - 1));
  $('#lb-next').addEventListener('click', () => showProject(current + 1));
  addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showProject(current - 1);
    if (e.key === 'ArrowRight') showProject(current + 1);
  });

  /* ---------- Contacto ---------- */
  const email = $('#correo').textContent.trim();
  $('#copiar').addEventListener('click', () => {
    const feedback = $('#copiado');
    navigator.clipboard.writeText(email).then(() => { feedback.textContent = 'Copiado'; }).catch(() => {
      const range = document.createRange();
      range.selectNodeContents($('#correo'));
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      feedback.textContent = 'Texto seleccionado';
    });
  });
  $('#formulario').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#f-nombre');
    const message = $('#form-msg');
    if (!name.value.trim()) {
      message.classList.add('error');
      message.textContent = 'Escribe tu nombre e institución para preparar el correo.';
      name.focus();
      return;
    }
    message.classList.remove('error');
    const subject = `Proyecto: ${$('#f-tipo').value} · ${name.value.trim()}`;
    const body = `Nombre e institución: ${name.value.trim()}\nTipo de proyecto: ${$('#f-tipo').value}\nFecha estimada: ${$('#f-fecha').value || 'por definir'}\n\n${$('#f-mensaje').value.trim()}`;
    message.textContent = `Abriendo tu programa de correo. Si no se abre, escribe a ${email}.`;
    location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  /* Arranque del carrusel (después del visor, que la deriva consulta) */
  renderCarousel();
  moveIndicator();
  requestAnimationFrame(tick);
  addEventListener('resize', () => { moveIndicator(); measureLoop(); }, { passive: true });

  /* ---------- Recorrido cinematográfico ---------- */
  if (!hasGsap || !prefersMotion) return;
  gsap.registerPlugin(ScrollTrigger);
  root.classList.add('cine');

  const ART = { navy: '#003153', beige: '#F5F5DC', green: '#006400', brown: '#C2701E', paper: '#FBFAF5' };
  const camera = $('#camara');
  const world = $('#mundo');
  const piece = $('#pieza');
  const scenes = $$('.escena');
  const indexButtons = $$('.indice button');
  let context = null;
  let timeline = null;

  const sceneAt = (t) => (t < 0.7 ? 0 : t < 2.4 ? 1 : t < 4.6 ? 2 : t < 6.8 ? 3 : 4);
  const markIndex = (t) => {
    const active = sceneAt(t);
    indexButtons.forEach((b, i) => b.classList.toggle('activo', i + 1 === active));
  };

  const buildJourney = () => {
    const rect = camera.getBoundingClientRect();
    const U = Math.min(rect.width, rect.height);
    const isPhone = matchMedia('(max-width: 820px)').matches;
    const k = isPhone ? 0.82 : 1;
    camera.style.setProperty('--u', `${U}px`);
    const size = {
      seal: { width: U * 0.4, height: U * 0.4 },
      panel: { width: U * 0.32, height: U * 0.76 },
      book: { width: U * 0.84, height: U * 0.58 },
      poster: { width: U * 0.48, height: U * 0.68 }
    };

    context = gsap.context(() => {
      gsap.set([piece, '.apl'], { xPercent: -50, yPercent: -50, x: 0, y: 0 });
      gsap.set(piece, { ...size.seal, borderRadius: '50%', backgroundColor: ART.navy });
      gsap.set(scenes.slice(1), { autoAlpha: 0, y: 40 });
      gsap.set('.apl', { scale: 0, autoAlpha: 0 });
      gsap.set('.esc-paneles > *, .esc-libro > *, .salida', { autoAlpha: 0 });
      gsap.set('.esc-paneles .lateral', { z: -90 });
      gsap.set('.esc-paneles .escala', { z: 60 });
      gsap.set('.confeti', { autoAlpha: 0, scale: 0 });

      timeline = gsap.timeline({
        defaults: { ease: 'power2.inOut', duration: 1 },
        scrollTrigger: {
          trigger: '#stage',
          start: 'top top',
          end: () => '+=' + innerHeight * 7,
          scrub: 0.8,
          pin: true,
          anticipatePin: 1,
          onUpdate: () => markIndex(timeline.time())
        }
      });

      timeline
        /* Escena 0 → 1: el sello institucional se acerca y aparecen sus aplicaciones */
        .addLabel('s0', 0)
        .to('.pista', { autoAlpha: 0, duration: 0.3 }, 0)
        .to(scenes[0], { autoAlpha: 0, y: -40, duration: 0.6 }, 0)
        .to(scenes[1], { autoAlpha: 1, y: 0, duration: 0.6 }, 0.45)
        .to(world, { scale: 1.06 }, 0)
        .to('.anillo', { rotation: 120, duration: 2.2, ease: 'none' }, 0)
        .to('.apl', { scale: 1, autoAlpha: 1, stagger: 0.08, duration: 0.8, ease: 'back.out(1.6)' }, 0.3)
        .addLabel('s1', 1.3)

        /* Escena 1 → 2: el sello se estira y se vuelve panel; la cámara entra en la sala */
        .to('.apl', {
          x: (i, el) => Math.sign(parseFloat(el.style.getPropertyValue('--x')) || 0.001) * U * 0.7,
          y: (i, el) => Math.sign(parseFloat(el.style.getPropertyValue('--y'))) * U * 0.5,
          rotation: (i) => (i % 2 ? -30 : 30), autoAlpha: 0, stagger: 0.04, duration: 0.8, ease: 'power2.in'
        }, 1.6)
        .to(scenes[1], { autoAlpha: 0, y: -40, duration: 0.6 }, 1.6)
        .to('.capa-sello', { autoAlpha: 0, duration: 0.4 }, 1.75)
        .to(piece, { ...size.panel, borderRadius: 0, backgroundColor: ART.beige, duration: 1.1 }, 1.8)
        .to('.capa-panel', { autoAlpha: 1, duration: 0.5 }, 2.4)
        .to(world, { scale: 1, rotationY: -16, duration: 1.2 }, 1.8)
        .fromTo('.esc-paneles .lateral', { x: (i) => (i ? 1 : -1) * U * 1.1 }, { x: 0, autoAlpha: 1, duration: 1.1 }, 1.9)
        .fromTo('.esc-paneles .piso', { scaleX: 0 }, { scaleX: 1, autoAlpha: 1, duration: 1 }, 2)
        .fromTo('.esc-paneles .cartela, .esc-paneles .escala, .esc-paneles .cota', { y: 20 }, { y: 0, autoAlpha: 1, stagger: 0.1, duration: 0.5 }, 2.5)
        .to(scenes[2], { autoAlpha: 1, y: 0, duration: 0.6 }, 2.4)
        .addLabel('s2', 3)

        /* La cámara rodea el panel sin perderlo de vista */
        .to(world, { rotationY: 12, duration: 1, ease: 'sine.inOut' }, 3)

        /* Escena 2 → 3: el panel se recuesta y se abre como catálogo sobre la mesa */
        .to('.esc-paneles > *', { autoAlpha: 0, x: '-=' + U * 0.5, stagger: 0.03, duration: 0.7 }, 4)
        .to(scenes[2], { autoAlpha: 0, y: -40, duration: 0.6 }, 4)
        .to('.capa-panel', { autoAlpha: 0, duration: 0.3 }, 4)
        .to(piece, { rotation: -90, backgroundColor: ART.paper, duration: 0.5 }, 4.05)
        .set(piece, { rotation: 0, width: size.panel.height, height: size.panel.width }, 4.55)
        .to(piece, { ...size.book, duration: 0.7 }, 4.55)
        .to('.capa-libro', { autoAlpha: 1, duration: 0.4 }, 4.95)
        .to(world, { rotationY: 0, rotationX: 18, scale: 1.04, duration: 1.1 }, 4.1)
        .to('.esc-libro > *', { autoAlpha: 1, stagger: 0.06, duration: 0.5 }, 4.85)
        .to(scenes[3], { autoAlpha: 1, y: 0, duration: 0.6 }, 4.7)
        .addLabel('s3', 5.3)

        /* La cámara sigue el giro de una página */
        .to('.hoja', { rotationY: -180, duration: 1, ease: 'power1.inOut' }, 5.4)
        .to(world, { rotationX: 10, duration: 1, ease: 'sine.inOut' }, 5.4)

        /* Escena 3 → 4: el catálogo gira sobre su eje y vuelve como afiche de festival */
        .to('.esc-libro > *', { autoAlpha: 0, duration: 0.4 }, 6.5)
        .to(scenes[3], { autoAlpha: 0, y: -40, duration: 0.6 }, 6.5)
        .to(piece, { rotationY: 90, duration: 0.45, ease: 'power2.in' }, 6.55)
        .set('.capa-libro', { autoAlpha: 0 }, 7)
        .set(piece, { ...size.poster, backgroundColor: ART.brown, rotationY: -90 }, 7)
        .set('.capa-afiche', { autoAlpha: 1 }, 7)
        .to(piece, { rotationY: 0, duration: 0.55, ease: 'power2.out' }, 7)
        .to(world, { rotationX: 0, scale: 1, duration: 1 }, 6.55)
        .fromTo('.capa-afiche > *', { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.07, duration: 0.5, ease: 'power3.out' }, 7.2)
        .to('.confeti', {
          x: (i, el) => parseFloat(el.dataset.x) * U * k,
          y: (i, el) => parseFloat(el.dataset.y) * U,
          rotation: (i) => (i % 2 ? 140 : -120), scale: 1, autoAlpha: 1, stagger: 0.025, duration: 0.8, ease: 'expo.out'
        }, 7.15)
        .to(scenes[4], { autoAlpha: 1, y: 0, duration: 0.6 }, 7.1)
        .addLabel('s4', 7.8)

        /* Respiro: el afiche flota y los confetis derivan */
        .to('.confeti', { y: '-=' + U * 0.06, rotation: '+=40', duration: 1, ease: 'none' }, 8)
        .to(piece, { rotation: -3, duration: 1, ease: 'sine.inOut' }, 8)

        /* Salida: el afiche se vuelve miniatura e introduce la grilla de proyectos */
        .to(scenes[4], { autoAlpha: 0, y: -40, duration: 0.5 }, 9)
        .to('.confeti', { autoAlpha: 0, scale: 0, stagger: 0.01, duration: 0.5 }, 9)
        .to(piece, { scale: 0.34, rotation: 0, x: isPhone ? 0 : innerWidth / 2 - (rect.left + rect.width / 2), y: isPhone ? U * 0.62 : 0, duration: 1 }, 9)
        .to('.salida', { autoAlpha: 1, duration: 0.5 }, 9.4);
    });
    markIndex(0);
  };

  /* Índice de escenas: lleva al punto exacto del recorrido */
  indexButtons.forEach((button) => button.addEventListener('click', () => {
    if (!timeline) return;
    scrollTo({ top: timeline.scrollTrigger.labelToScroll(button.dataset.label), behavior: 'smooth' });
  }));


  buildJourney();

  /* Reconstruir al cambiar el ancho (no al ocultarse la barra del navegador móvil) */
  let lastWidth = innerWidth;
  let resizeTimer = null;
  addEventListener('resize', () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const progress = timeline ? timeline.scrollTrigger.progress : 0;
      context.revert();
      buildJourney();
      ScrollTrigger.refresh();
      if (progress > 0 && progress < 1) scrollTo(0, timeline.scrollTrigger.start + progress * (timeline.scrollTrigger.end - timeline.scrollTrigger.start));
    }, 250);
  });
})();
