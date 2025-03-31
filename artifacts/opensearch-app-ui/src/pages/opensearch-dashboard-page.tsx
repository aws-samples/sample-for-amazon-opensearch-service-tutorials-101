import { useState, useEffect, useContext } from "react";
import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import { AppContext } from "../common/context";
import { withAuthenticator } from "@aws-amplify/ui-react";
import { ContentLayout, Container, Button } from "@cloudscape-design/components";

function OpensearchDashboardPage(props: AppPage) {

  const appData = useContext(AppContext);
  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      })      
    }
    init()
  }, [])

  async function load_opensearch_dashboard2() {
    const url = "https://hljsemw670.execute-api.us-east-1.amazonaws.com/dev/proxy/_dashboards/app/home#/";
    window.open(url)
}


  async function load_opensearch_dashboard() {
    const token = appData.userinfo.tokens.idToken.toString();
    const url = "https://hljsemw670.execute-api.us-east-1.amazonaws.com/dev/proxy/_dashboards/app/home#/";

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Connection': 'keep-alive'
            }
        });

        if (response.ok) {
            const content = await response.text();
            const modified_content = modifyContent(content)
            const cspContent = [
              "script-src 'unsafe-inline' 'unsafe-eval' https://hljsemw670.execute-api.us-east-1.amazonaws.com",
              "object-src 'none'",
              "style-src 'self' 'unsafe-inline' https://hljsemw670.execute-api.us-east-1.amazonaws.com",
              "style-src-elem 'self' 'unsafe-inline' https://hljsemw670.execute-api.us-east-1.amazonaws.com",
              "img-src 'self' data: https://hljsemw670.execute-api.us-east-1.amazonaws.com",
              "font-src 'self' data: https://hljsemw670.execute-api.us-east-1.amazonaws.com",
              "connect-src 'self' https://hljsemw670.execute-api.us-east-1.amazonaws.com"
            ].join('; ');
            
            // const cspContent = [
            //   "script-src 'unsafe-inline' 'unsafe-eval' https://hljsemw670.execute-api.us-east-1.amazonaws.com",
            //   "object-src 'none'"
            // ].join('; ');

            const safeContent = `
              <!DOCTYPE html>
              <html>
              <head>
                  <meta http-equiv="Content-Security-Policy" content="${cspContent}">
                  ${modified_content}
              </head>
              <body>
              
              </body>
              </html>
            `;
            var newWindow = window.open('about:blank', '_blank')
            
            // Write the content to the new window
            if (newWindow) {
                newWindow.document.open();
                newWindow.document.write(safeContent);
                newWindow.document.close();
                newWindow.location.href=url
            }
        } else {
            console.error('Failed to load dashboard:', response.status);
            // newWindow?.close();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        // newWindow?.close();
    }
}

const modifyContent = (htmlContent: string) => {
  const baseUrl = 'https://hljsemw670.execute-api.us-east-1.amazonaws.com';
  const baseTag = `<base href="${baseUrl}/dev/proxy/_dashboards/">`;

  // First replace document.write calls for scripts
  const modifiedHtml = htmlContent
    .replace(
      /document\.write\(\s*['"`]<script[^>]+src=['"]([^'"]+)['"][^>]*>(<\/script>)?['"`]\s*\)/g,
      (match, src) => {
        const fullSrc = src.startsWith('/') ? `${baseUrl}${src}` : src;
        return `
          (function() {
            var script = document.createElement('script');
            script.src = '${fullSrc}';
            script.async = false;
            document.head.appendChild(script);
          })();
        `;
      }
    )
    .replace('window.__osdCspNotEnforced__ = true', 'window.__osdCspNotEnforced__ = false')
    .replace('<head>', `<head>${baseTag}`)
    .replace(
      /@font-face\s*{[^}]*src:[^}]*}/g,
      (match) => {
        return match.replace(
          /url\(['"']?([^'"'")]+)['"']?\)/g,
          (urlMatch, path) => {
            if (path.startsWith('/')) {
              return `url('${baseUrl}${path}')`;
            }
            return urlMatch;
          }
        );
      }
    );

  return modifiedHtml;
};


  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
    >
      <Container fitHeight
      >
      <div id="opensearch_dashboard_div"></div>
      <Button variant="primary" onClick={load_opensearch_dashboard}>Access Opensearch Dashboard</Button>
      <div id="iframe_container"></div>
      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(OpensearchDashboardPage)