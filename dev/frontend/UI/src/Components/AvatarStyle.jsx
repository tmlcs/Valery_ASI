import { createGlobalStyle } from 'styled-components'; // If using styled-components

const AvatarStyle = createGlobalStyle`
 .Avatar {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    height: 100%;
    width: 100%;
    /* other global styles */
  }

  .Avatar-sections {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    align-items: center;
    width: 100%;
    height: 100%;
    /* other global styles */
  }
  
  .Avatar-sections .card-spotlight:nth-child(1) {
    width: 100%;
  }

  .Avatar-sections .infinite-menu{
  width: 100%;
  }

  .Avatar-sections .card-spotlight:nth-child(2) {
    width: 350px;
    }

  @media (min-width: 1332px) {
    .Avatar-sections .card-spotlight:nth-child(1) {
      width: 1024px;
    }
  }
    @media (min-width: 1892px) {
    .Avatar-sections .card-spotlight:nth-child(2) {
    width: 500px;
    }
  }
  
  .Avatar-sections img {
    width: 150px;
 }
`;

export default AvatarStyle;