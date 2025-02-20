import React, { useState } from 'react';
import { VscArrowLeft, VscArrowRight, VscRefresh, VscHome } from 'react-icons/vsc';

const Explorer = () => {
  const [url, setUrl] = useState('');
  const [webView, setWebView] = useState(null);

  const handleNavigate = (e) => {
    e.preventDefault();
    if (webView) {
      webView.src = url.startsWith('http') ? url : `https://${url}`;
    }
  };

  return (
    <div className="explorer">
      <div className="explorer-nav">
        <button onClick={() => webView?.goBack()}>
          <VscArrowLeft />
        </button>
        <button onClick={() => webView?.goForward()}>
          <VscArrowRight />
        </button>
        <button onClick={() => webView?.reload()}>
          <VscRefresh />
        </button>
        <form onSubmit={handleNavigate}>
          <input 
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL"
          />
        </form>
      </div>
      <iframe
        ref={(ref) => setWebView(ref)}
        className="web-view"
        src="about:blank"
        title="Web Browser"
      />
    </div>
  );
};

export default Explorer;
