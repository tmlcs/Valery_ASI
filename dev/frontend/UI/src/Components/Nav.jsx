import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import DecryptedText from '../../TextAnimations/DecryptedText/DecryptedText';


const navItems = [
  { id: 'Explorer', icon: 'travel_explore', label: 'Explore', dropdown: [] },
  { id: 'DashBoard', icon: 'dashboard', label: 'DashBoard', dropdown: [] },
  { id: 'Avatar', icon: 'account_circle', label: 'Avatar', dropdown: [] },
  {
    id: 'User',
    icon: 'person',
    label: 'Usuario',
    dropdown: [
      { action: 'curriculum', icon: 'article', label: 'Curriculum' },
      { action: 'new-analysis', icon: 'add', label: 'Nuevo Análisis' },
      { action: 'history', icon: 'history', label: 'Historial' },
      { action: 'settings', icon: 'settings', label: 'Configuración' }
    ]
  },
  { id: 'management', icon: 'work', label: 'Gestión', dropdown: [
    { action: 'job-management', icon: 'work', label: 'Laboral' },
    { action: 'employees', icon: 'people', label: 'Empleados' },
    { action: 'departments', icon: 'business', label: 'Departamentos' },
    { action: 'projects', icon: 'engineering', label: 'Proyectos' },
    { action: 'management-tasks', icon: 'task', label: 'Tareas' },
    { action: 'financial', icon: 'bar_chart', label: 'Financiera' },
    { action: 'invoices', icon: 'receipt', label: 'Facturas' },
    { action: 'payments', icon: 'payment', label: 'Pagos' },
    { action: 'reports', icon: 'analytics', label: 'Reportes' },
    { action: 'inventory', icon: 'inventory', label: 'De Inventario' },
    { action: 'products', icon: 'inventory_2', label: 'Productos' },
    { action: 'orders', icon: 'shopping_cart', label: 'Ordenes' },
    { action: 'suppliers', icon: 'local_shipping', label: 'Proveedores' },
    { action: 'crm', icon: 'contacts', label: 'de CRM' },
    { action: 'contacts', icon: 'contact_page', label: 'Contactos' },
    { action: 'companies', icon: 'business', label: 'Empresas' },
    { action: 'deals', icon: 'monetization_on', label: 'Negocios' },
    { action: 'crm-tasks', icon: 'task', label: 'Tareas' },
    { action: 'social', icon: 'people', label: 'Social' },
    { action: 'streaming', icon: 'stream', label: 'de Streaming' },
    { action: 'marketing', icon: 'campaign', label: 'de Marketing' }
  ] },
  { id: 'Study-Area', icon: 'school', label: 'Área de Estudio', dropdown: [
    { action: 'study-projects', icon: 'engineering', label: 'Proyectos' },
    { action: 'study-tasks', icon: 'task', label: 'Tareas' }
  ] },
  { id: 'Chat', icon: 'chat', label: 'Chat', dropdown: [] },
  { id: 'recognition', icon: 'pattern', label: 'Reconocimiento de', dropdown: [
    { action: 'audio-recognition', icon: 'mic', label: 'Audio' },
    { action: 'vision-recognition', icon: 'visibility', label: 'Vision' },
    { action: 'settings', icon: 'settings', label: 'Configuración' }
  ] },
  {
    id: 'editor',
    icon: 'image',
    label: 'Editor de',
    dropdown: [
      { action: 'image-editor', icon: 'image', label: 'Imagen' },
      { action: 'video-editor', icon: 'videocam', label: 'Video' },
      { action: 'audio-editor', icon: 'audiotrack', label: 'Audio' },
      { action: 'batch', icon: 'batch_prediction', label: 'Proceso por Lotes' }
    ]
  },
  { id: 'calendar', icon: 'calendar_month', label: 'Calendario', dropdown: [] },
  { id: 'support', icon: 'support', label: 'Soporte', dropdown: [
    { action: 'tickets', icon: 'support_agent', label: 'Tickets' },
    { action: 'knowledge-base', icon: 'article', label: 'Base de Conocimientos' },
    { action: 'settings', icon: 'settings', label: 'Configuración' }
  ] },
];

const NavItem = styled(NavLink)` // Use NavLink here
  padding: 0.75rem 0rem;
  margin: 0.25rem 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: background 0.2s ease;
  position: relative;
  color: ${props => props.theme.textPrimary};
  text-decoration: none; // Remove underlines from links

  &.active {  // Style for the active tab
    background: #2a2a2a; // Or any other active style
  }

  &:hover {
    background: #2a2a2a;
  }

  &:focus {
    outline: 2px solid ${props => props.theme.primary};
    outline-offset: 2px;
  }
`;

const NavItemWrapper = styled.li`
  position: relative;
  list-style: none;
`;

const NavDropdown = styled.div`
  position: absolute;
  left: 100%;
  top: 0;
  min-width: 200px;
  background: #2a2a2a;
  border-radius: 4px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s;
  z-index: 1001;

  ${NavItemWrapper}:hover & {
    opacity: 1;
    visibility: visible;
  }
`;

const NavContainer = styled.nav`
  background: ${props => props.theme.navBackground};
  color: ${props => props.theme.textPrimary};
  width: 250px;
  height: 100vh;
  position: relative;
  top: 0;
  left: 0;
  z-index: 1000;
  box-shadow: 2px 0 5px rgba(0,0,0,0.2);

  @media (max-width: 768px) {
    width: 60px;
    
    ${NavItem} span:last-child {
      display: none;
    }
    
    ${NavDropdown} {
      left: 60px;
    }
  }
`;

const DropdownItem = styled.div`
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: #3a3a3a;
  }
`;

export default function Nav() {
  const [activeMenu, setActiveMenu] = React.useState(null);

  return (
    <NavContainer role="navigation" aria-label="Navegación principal">
      <ul>
        <h1>
          <DecryptedText
            text= "Valery Menu"
            animateOn="view"
            revealDirection="start"
            sequential
            speed={100}
            maxIterations={20}
            className="revealed"
            parentClassName="all-letters"
            encryptedClassName="encrypted"
          />
         </h1>
        {navItems.map((item) => (
          <NavItemWrapper key={item.id}>
            <NavItem 
              to={`/${item.id}`} // Link to the corresponding route
              role="menuitem"
              aria-haspopup={item.dropdown.length > 0}
              aria-expanded={activeMenu === item.id}
              tabIndex="0"
            >
              <span className="material-icons">{item.icon}</span>
              {item.label}
            </NavItem>
            {item.dropdown.length > 0 && (
              <NavDropdown 
                role="menu"
                aria-hidden={activeMenu !== item.id}
              >
                {item.dropdown.map((dropdownItem) => (
                  <DropdownItem 
                    key={`${item.id}-${dropdownItem.action}`}
                    role="menuitem"
                    tabIndex="0"
                    onClick={() => {
                       setActiveMenu(null);
                       // Handle dropdown item click, e.g., navigate to a specific route
                       // You might need to adjust this based on your routing setup.
                       // Example: window.location.href = `/${item.id}/${dropdownItem.action}`;
                    }}
                  >
                    <span className="material-icons">{dropdownItem.icon}</span>
                    {dropdownItem.label}
                  </DropdownItem>
                ))}
              </NavDropdown>
            )}
          </NavItemWrapper>
        ))}
      </ul>
    </NavContainer>
  );
}
