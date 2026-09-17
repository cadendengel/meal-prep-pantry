import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

/**
 * The application header.
 *
 * Every signed-in page shares it, so the navigation markup exists once.
 */
function AppNav({ user, onLogout }) {
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/dashboard', label: 'Meals' },
    { to: '/pantry', label: 'Pantry' },
    { to: '/shopping-list', label: 'Shopping List' },
    { to: '/settings', label: 'Settings' },
  ];

  return (
    <nav className="navbar">
      <div className="nav-content">
        <h1>🍽️ Meal Prep Pantry</h1>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>

        <div id="primary-navigation" className={`nav-actions ${open ? 'nav-actions-open' : ''}`}>
          <ul className="nav-links">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          {user?.name && <span className="user-name">{user.name}</span>}
          <button onClick={onLogout} className="btn btn-secondary">Logout</button>
        </div>
      </div>
    </nav>
  );
}

export default AppNav;
