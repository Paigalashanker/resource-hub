import React, { useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

const navItems = [
    ['Home', 'index.html'],
    ['Projects', 'projects.html'],
    ['Downloads', 'downloads.html'],
    ['IoT (NPTEL)', 'iot.html'],
    ['About', 'about.html'],
    ['Contact', 'contact.html']
];
const mathFloaters = ['AI', 'PY', 'TF', 'NP', 'PD', 'JS', 'GH', 'CV'];

function Header() {
    const [menuOpen, setMenuOpen] = useState(false);

    return React.createElement('header', { className: 'glass-header' },
        React.createElement('a', { href: 'index.html', className: 'glass-brand' },
            React.createElement('span', { className: 'brand-mark' }, 'CV'),
            React.createElement('span', null,
                React.createElement('strong', null, 'CAMPUSVAULT'),
                React.createElement('small', null, 'AI & DS / SREC')
            )
        ),
        React.createElement('button', {
            className: 'glass-menu-button',
            onClick: () => setMenuOpen(!menuOpen),
            'aria-label': 'Toggle navigation',
            'aria-expanded': menuOpen
        }, menuOpen ? 'Close' : 'Menu'),
        React.createElement('nav', { className: `glass-nav ${menuOpen ? 'is-open' : ''}` },
            navItems.map(([label, href]) => React.createElement('a', {
                key: href,
                className: href === 'about.html' ? 'is-active' : '',
                href,
                onClick: () => setMenuOpen(false)
            }, label))
        )
    );
}

function AboutPage() {
    const [activeSkill, setActiveSkill] = useState('Machine learning');

    const skillGroups = {
        'Machine learning': ['Python', 'scikit-learn', 'XGBoost', 'NumPy', 'Pandas'],
        'Product engineering': ['FastAPI', 'REST APIs', 'Firebase', 'ESP8266 IoT'],
        'Frontend craft': ['React', 'JavaScript', 'CSS motion', 'Chrome Extensions']
    };

    return React.createElement(React.Fragment, null,
        React.createElement('a', { className: 'skip-link', href: '#main-content' }, 'Skip to main content'),
        React.createElement('div', { className: 'about-atmosphere' }),
        React.createElement('div', { className: 'math-floaters', 'aria-hidden': 'true' },
            mathFloaters.map((formula, index) => React.createElement('span', {
                className: 'math-floater',
                key: formula,
                style: { '--floater-index': index }
            }, React.createElement('span', { className: 'math-formula' }, formula), React.createElement('i', null)))
        ),
        React.createElement('div', { className: 'about-shell' },
            React.createElement(Header),
            React.createElement('main', { id: 'main-content', className: 'about-content' },
                React.createElement('section', { className: 'about-intro' },
                    React.createElement('div', { className: 'eyebrow' }, React.createElement('span', { className: 'status-pip' }), 'Student resource platform'),
                    React.createElement('h1', null, 'Ideas made ', React.createElement('em', null, 'visible.')),
                    React.createElement('p', null, 'CampusVault is a student-built space for exploring projects, notes, downloads, and practical learning resources across AI, Data Science, programming, and IoT.'),
                    React.createElement('div', { className: 'intro-actions' },
                        React.createElement('a', { className: 'glass-button glass-button-primary', href: 'projects.html' }, 'Explore projects <span>↗</span>'),
                        React.createElement('a', { className: 'text-button', href: 'mailto:paigalashanker@gmail.com' }, 'Start a conversation')
                    )
                ),
                React.createElement('section', { className: 'profile-grid' },
                    React.createElement('article', { className: 'glass-panel profile-card tilt-card' },
                        React.createElement('div', { className: 'profile-orbit' }, React.createElement('span', null, 'PS')),
                        React.createElement('div', { className: 'profile-copy' },
                            React.createElement('div', { className: 'profile-meta' }, 'Based in Tirupati · India'),
                            React.createElement('h2', null, 'Paigala Delli Sankar'),
                            React.createElement('p', null, '3rd Year · Artificial Intelligence & Data Science'),
                            React.createElement('p', { className: 'muted-copy' }, 'Sree Rama Engineering College'),
                            React.createElement('div', { className: 'profile-links' },
                                React.createElement('a', { href: 'https://github.com/Paigalashanker', target: '_blank', rel: 'noreferrer' }, 'GitHub ↗'),
                                React.createElement('a', { href: 'mailto:paigalashanker@gmail.com' }, 'Email ↗')
                            )
                        )
                    ),
                    React.createElement('article', { className: 'glass-panel signal-card' },
                        React.createElement('div', { className: 'card-label' }, 'Current signal'),
                        React.createElement('div', { className: 'signal-line' }),
                        React.createElement('h3', null, 'Learning in public.'),
                        React.createElement('p', null, 'Turning notes, experiments, and small failures into tools that make the next project clearer.'),
                        React.createElement('div', { className: 'signal-stats' },
                            React.createElement('p', null, 'Built for students who want a practical starting point for study, experiments, and project work.')
                        )
                    )
                ),
                React.createElement('section', { className: 'glass-panel about-purpose-card' },
                    React.createElement('div', { className: 'card-label' }, 'What is CampusVault?'),
                    React.createElement('h2', null, 'A useful shelf for student work.'),
                    React.createElement('p', null, 'CampusVault brings together the materials already maintained in this repository so students can find them in one place instead of searching across scattered folders and links.'),
                    React.createElement('div', { className: 'pill-row' }, ['AI & Machine Learning', 'Data Science', 'Programming', 'Projects', 'IoT & NPTEL', 'Notes & downloads'].map(item => React.createElement('span', { key: item }, item)))
                ),
                React.createElement('section', { className: 'lower-grid' },
                    React.createElement('article', { className: 'glass-panel philosophy-card' },
                        React.createElement('div', { className: 'card-label' }, '01 / Philosophy'),
                        React.createElement('h2', null, 'Build with clarity, then add the magic.'),
                        React.createElement('p', null, 'My work lives between dependable engineering and playful exploration: machine learning pipelines, automation, IoT experiments, and interfaces that feel good to use.'),
                        React.createElement('div', { className: 'pill-row' }, ['Clarity', 'Resilience', 'Purpose'].map(item => React.createElement('span', { key: item }, item)))
                    ),
                    React.createElement('article', { className: 'glass-panel skills-card' },
                        React.createElement('div', { className: 'card-label' }, '02 / Toolkit'),
                        React.createElement('div', { className: 'skill-tabs' }, Object.keys(skillGroups).map(group => React.createElement('button', { key: group, className: activeSkill === group ? 'is-active' : '', onClick: () => setActiveSkill(group) }, group))),
                        React.createElement('div', { className: 'skill-list' }, skillGroups[activeSkill].map((skill, index) => React.createElement('span', { key: skill, style: { '--skill-index': index } }, skill)))
                    )
                )
            ),
            React.createElement('footer', { className: 'about-footer' },
                React.createElement('span', null, 'Resource Hub / About'),
                React.createElement('span', null, 'Maintained by Paigala Delli Sankar'),
                React.createElement('nav', { 'aria-label': 'Footer navigation' },
                    React.createElement('a', { href: 'privacy.html' }, 'Privacy'),
                    React.createElement('a', { href: 'terms.html' }, 'Terms'),
                    React.createElement('a', { href: 'disclaimer.html' }, 'Disclaimer'),
                    React.createElement('a', { href: 'contact.html' }, 'Contact')
                )
            )
        )
    );
}

createRoot(document.getElementById('about-root')).render(React.createElement(AboutPage));

for (const card of document.querySelectorAll('.tilt-card')) {
    card.addEventListener('pointermove', event => {
        const bounds = card.getBoundingClientRect();
        const rotateX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -5;
        const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 5;
        card.style.setProperty('--rotate-x', `${rotateX}deg`);
        card.style.setProperty('--rotate-y', `${rotateY}deg`);
    });
    card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rotate-x', '0deg');
        card.style.setProperty('--rotate-y', '0deg');
    });
}
