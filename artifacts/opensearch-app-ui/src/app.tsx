import { useState, useEffect } from "react";
import { Routes, Route, HashRouter } from 'react-router-dom';
import { AppLayout, TopNavigation, SideNavigation, Alert } from '@cloudscape-design/components';
import { Hub } from 'aws-amplify/utils';
import { signOut } from 'aws-amplify/auth';
import { AppContext } from "./common/context";
import { NotFound, OpensearchDashboardPage, HomePage, Help } from './pages'
import '@aws-amplify/ui-react/styles.css';
import KeywordMultiPage from "./pages/keyword-multi-page";
import KeywordMatchPage from "./pages/keyword-match-page";
import KeywordPrefixPage from "./pages/keyword-prefix-page";
import KeywordRangePage from "./pages/keyword-range-page";
import IndexDocumentPage from "./pages/index-document-page";
import KeywordWildcardPage from "./pages/keyword-wildcard-page";

export default function App() {
  const [activeHref, setActiveHref] = useState("#/");
  const [utility, setUtility] = useState([])
  const [appData, setAppData] = useState({ userinfo: null })
  const Router = HashRouter;

  useEffect(() => {
    Hub.listen("auth", (data) => {
      // setNotificationVisible(true);
      // setNotificationMsg("Validating Authentication")
      switch (data.payload.event) {
        case "signedOut":
          setAppData({ userinfo: null })
          break;
      }
    })
  }, [])

  useEffect(() => {
    if (appData.userinfo != null) {
      setUtility([{
        type: "menu-dropdown",
        text: "Profile",
        description: appData.userinfo.signInDetails.loginId,
        iconName: "user-profile",
        onItemClick: (e) => {
          if (e.detail.id == 'signout') { signOut({ global: true }) }
        },
        items: [
          { id: "signout", text: "Sign out" }
        ]
      }])
      localStorage.setItem('token', appData.userinfo.tokens.idToken.toString())
    } else {
      setUtility([])
    }
  }, [appData])


  return (
    <AppContext.Provider value={appData}>
      <div id="custom-main-header" style={{ position: 'sticky', top: 0, zIndex: 1002 }}><TopNavigation
        identity={{
          href: '#',
          title: 'Opensearch end-to-end tutorial',
        }}

        utilities={[
          {
            type: "button",
            text: "Github",
            href: "https://github.com/aws-samples/sample-for-amazon-opensearch-tutorials-101/",
            external: true,
            externalIconAriaLabel: " (opens in a new tab)"
          },
          ...utility
        ]}
      /></div>
      <AppLayout
        disableContentPaddings
        headerSelector='#custom-main-header'
        toolsHide={false}
        tools={
          <Router>
            <Routes>
              <Route path="/" element={<Help setPageId="home" />} />
              <Route path="/document-chat" element={<Help setPageId="doc-chat" />} />
              <Route path="/document-chat/manage-document" element={<Help setPageId="doc-chat-manage" />} />
              <Route path="/sentiment-analysis" element={<Help setPageId="sentiment" />} />
              <Route path="/multi-agent" element={<Help setPageId="multi-agent" />} />
              <Route path="/ocr" element={<Help setPageId="ocr" />} />
              <Route path="/pii" element={<Help setPageId="pii" />} />
              <Route path="*" element={<Help setPageId="404" />} />
            </Routes>
          </Router>
        }

        navigation={<SideNavigation
          activeHref={activeHref}
          header={{ href: "#/", text: "Apps" }}
          onFollow={event => {
            if (!event.detail.external) {
              setActiveHref(event.detail.href);
            }
          }}
          items={[
            { type: "link", text: "Index Documents", href: "#/index-documents" },
            {
              type: "link-group", text: "Keyword Search", href: "#",
              items: [
                { type: "link", text: "Prefix Match", href: "#/keyword-search/prefix-match" },
                { type: "link", text: "Multi Match", href: "#/keyword-search/multi-match" },
                { type: "link", text: "Minimum Should Match", href: "#/keyword-search/minimum-should-match" },
                { type: "link", text: "Wildcard Match", href: "#/keyword-search/wildcard-match" },
                { type: "link", text: "Range Filter", href: "#/keyword-search/range-filter" },
              ]
            },
            // { type: "link", text: "Opensearch Dashboard", href: "#/opensearch-dashboard" }
          ]}
        />}
        content={
          <Router>
            <Routes>
              <Route path="/" element={<HomePage />} />
              {/* <Route path="/opensearch-dashboard" element={<OpensearchDashboardPage setAppData={setAppData} />} /> */}
              <Route path="/index-documents" element={<IndexDocumentPage setAppData={setAppData} />} />
              <Route path="/keyword-search/prefix-match" element={<KeywordPrefixPage setAppData={setAppData} />} />
              <Route path="/keyword-search/minimum-should-match" element={<KeywordMatchPage setAppData={setAppData} />} />
              <Route path="/keyword-search/multi-match" element={<KeywordMultiPage setAppData={setAppData} />} />
              <Route path="/keyword-search/wildcard-match" element={<KeywordWildcardPage setAppData={setAppData} />} />
              <Route path="/keyword-search/range-filter" element={<KeywordRangePage setAppData={setAppData} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        }
      />
    </AppContext.Provider>
  );
}
