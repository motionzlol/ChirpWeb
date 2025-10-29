const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear().toString();

function setInviteLinks(inviteUrl) {
    const ids = ["invite-btn", "cta-invite"]; 
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute("href", inviteUrl);
    });
}

// Navbar: point directly to Netlify Function (works even without redirects)
setInviteLinks("/.netlify/functions/auth-login");

// Auth state check and UI update
(async function initAuth() {
    const authContainer = document.getElementById('nav-auth-container');
    const loginBtn = document.getElementById('invite-btn');
    const userBtn = document.getElementById('nav-user-btn');
    const dropdown = document.getElementById('nav-dropdown');
    const avatarEl = document.getElementById('nav-avatar');
    const usernameEl = document.getElementById('nav-username');

    try {
        const res = await fetch('/.netlify/functions/auth-me', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error('not authenticated');
        const data = await res.json();
        if (data.ok && data.user) {
            if (authContainer) authContainer.style.display = 'flex';
            if (loginBtn) loginBtn.style.display = 'none';
            if (avatarEl) avatarEl.src = data.user.avatar_url;
            if (usernameEl) usernameEl.textContent = data.user.global_name || data.user.username;
        }
    } catch (e) {
        if (authContainer) authContainer.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'inline-flex';
    }

    if (userBtn && dropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const expanded = userBtn.getAttribute('aria-expanded') === 'true';
            userBtn.setAttribute('aria-expanded', !expanded);
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            userBtn.setAttribute('aria-expanded', 'false');
            dropdown.classList.remove('show');
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());
    }
})();

// Subtle scroll-elevate effect for the navbar
const nav = document.querySelector(".nav");
let last = 0;
window.addEventListener("scroll", () => {
    const y = window.scrollY || window.pageYOffset;
    if (!nav) return;
    if (y > 6 && last <= 6) nav.style.boxShadow = "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.35)";
    if (y <= 6 && last > 6) nav.style.boxShadow = "none";
    last = y;
});

// Smooth in-page scroll with sticky-nav offset
const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAV_OFFSET = 72;
document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || href === '#' || href.length < 2) return;
        const id = href.slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
        window.scrollTo({ top: Math.max(y, 0), behavior: prefersReduced ? 'auto' : 'smooth' });
        history.pushState(null, '', `#${id}`);
    });
});

// FAQ open/close animation (height transition)
(function initFaq() {
    const detailsList = document.querySelectorAll('.faq__card details');
    detailsList.forEach((d) => {
        const summary = d.querySelector('summary');
        if (!summary) return;

        let content = d.querySelector('.details__content');
        if (!content) {
            content = document.createElement('div');
            content.className = 'details__content';
            const nodes = [];
            let n = summary.nextSibling;
            while (n) { nodes.push(n); n = n.nextSibling; }
            nodes.forEach((node) => content.appendChild(node));
            d.appendChild(content);
        }

        const setHeight = (h) => { content.style.height = `${h}px`; };

        if (d.open) setHeight(content.scrollHeight);

        summary.addEventListener('click', (ev) => {
            ev.preventDefault();
            if (prefersReduced) {
                d.open = !d.open;
                setHeight(d.open ? content.scrollHeight : 0);
                return;
            }

            if (!d.open) {
                d.open = true;
                setHeight(0);
                requestAnimationFrame(() => { setHeight(content.scrollHeight); });
            } else {
                const start = content.scrollHeight;
                setHeight(start);
                requestAnimationFrame(() => setHeight(0));
                const onEnd = () => {
                    d.open = false;
                    content.removeEventListener('transitionend', onEnd);
                };
                content.addEventListener('transitionend', onEnd);
            }
        });
    });
})();

// Scroll-reveal for glass cards
(function revealOnScroll() {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = Array.from(document.querySelectorAll('.hero__card, .features__grid, .feature, .faq__card, .footer__inner'));
    if (!targets.length) return;
    targets.forEach((el) => el.classList.add('reveal'));
    if (prefersReduced) {
        targets.forEach((el) => el.classList.add('is-visible'));
        return;
    }
    const inViewport = (el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
    };
    targets.forEach((el) => { if (inViewport(el)) el.classList.add('is-visible'); });

    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add('is-visible');
                io.unobserve(e.target);
            }
        });
    }, { root: null, rootMargin: '0px', threshold: 0 });
    targets.forEach((el) => io.observe(el));
})();

