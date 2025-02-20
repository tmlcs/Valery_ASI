import { createGlobalStyle } from 'styled-components'; // If using styled-components

const DashBoardStyle = createGlobalStyle`
 .DashBoard {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-around;
    align-items: center;
    height: 100%;
    width: 100%;
    /* other global styles */
  }

  .dashboard-sections {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    align-items: center;
    width: 100%;
    height: 100%;
    /* other global styles */
  }
  
  .dashboard-sections .card-spotlight:nth-child(1) {
    width: 100%;
  }

  .dashboard-sections .infinite-menu{
  width: 100%;
  }

  .dashboard-sections .card-spotlight:nth-child(2) {
    width: 350px;
    }

  @media (min-width: 1332px) {
    .dashboard-sections .card-spotlight:nth-child(1) {
      width: 1024px;
    }
  }
    @media (min-width: 1892px) {
    .dashboard-sections .card-spotlight:nth-child(2) {
    width: 500px;
    }
  }

  .dashboard-sections .avatar {
    width: 350px;
  }
  .dashboard-sections .user-avatar {
    width: 150px;
 }
`;

export default DashBoardStyle;