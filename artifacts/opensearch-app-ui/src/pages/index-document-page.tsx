import { useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import * as React from "react";
import Grid from "@cloudscape-design/components/grid";
import HelpPanel from "@cloudscape-design/components/help-panel";
import config from "../config.json";

import {
  Container,
  ContentLayout,
  Header, Button,
  Icon,
  ExpandableSection,
  SpaceBetween,
  Alert
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import { AppContext } from "../common/context";

function IndexDocumentPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [value, setValue] = React.useState("");
  const [showAlert, setShowAlert] = React.useState(false)
  const [alertMsg, setAlertMsg] = React.useState("")
  const [alertType, setAlertType] = React.useState("error")


  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      })
    }
    init();
  }, [])

  const handle_notifications = (message, notify_type) => {
    setAlertMsg(message)
    setAlertType(notify_type)
    setShowAlert(true)
  }

  async function create_index() {
    setShowAlert(false);
    // Trigger Index API
    const token = appData.userinfo.tokens.idToken.toString();
    // call api gateway and pass in the value and set Authorization header
    fetch(config["apiUrl"] + "/index", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({})
    }).then(function (result) {
      handle_notifications("Product catalog indexing in-progress. You can now try Keyword search", "success")
      console.log(result)
    }).catch(function (err) {
      handle_notifications("Product catalog indexing failed", "error")
      console.log(err)
    });
    handle_notifications("Product catalog indexing started", "success")
  }

  async function delete_index() {
    setShowAlert(false);
    // Trigger Index API
    const token = appData.userinfo.tokens.idToken.toString();
    // call api gateway and pass in the value and set Authorization header
    fetch(config["apiUrl"] + "/index", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({})
    }).then(function(result){
      handle_notifications("Product catalog index deleted", "success")
      console.log(result)
    }).catch(function(err){
      handle_notifications("Product catalog index deletion failed", "error")
      console.log(err)
    });
  }

  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
      header={
        <Header
          variant="h1"
          description="Add(Index) default products to your Opensearch datastore"
          actions={<Button iconName="settings" variant="icon" />}>
          Lexical Search
        </Header>
      }
    >
      <Container fitHeight
      >
        {(showAlert && alertType == 'error') ? <Alert dismissible statusIconAriaLabel="Error" type='error' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'success') ? <Alert dismissible statusIconAriaLabel="Success" type='success' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'warning') ? <Alert dismissible statusIconAriaLabel="Warning" type='warning' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'info') ? <Alert dismissible statusIconAriaLabel="Info" type='info' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
       
        <SpaceBetween size={"xxs"} direction="vertical">
          <ExpandableSection defaultExpanded headerText="Guide to indexing documents on Opensearch">
            <HelpPanel
              footer={
                <div>
                  <h3>
                    Learn more{" "}
                    <Icon name="external" size="inherit" />
                  </h3>
                  <ul>
                    <li>
                      <a href="https://opensearch.org/docs/latest/im-plugin/">Link to documentation</a>
                    </li>
                  </ul>
                </div>
              }

            >
              <div>
                <p>
                  Indexing in OpenSearch Indexing is the fundamental process of storing and organizing data in OpenSearch for efficient retrieval. It involves adding JSON documents to an index, where each document is identified by a unique ID.
                  You can index documents either individually using the index API or in bulk using the _bulk API for better performance.
                </p>
                <p>
                  <b>In our example</b>, we trigger a bulk index operation by clicking on the <b><i>Index Product Catalog</i> button</b> below, which generates a POST query on our Opensearch cluster as follows:
                </p>
                <pre>
                  <code>POST _bulk</code>
                  <code>{JSON.stringify({ "index": { "_index": "products", "_id": "1" } })}</code>
                  <code>{JSON.stringify({ "title": "Acer Aspire 5", "description": "Acer Aspire 5 is a Windows 10 laptop", "color": "silver", "price": 299.99 })}</code>
                  <code>{JSON.stringify({ "index": { "_index": "products", "_id": "2" } })}</code>
                  <code>{JSON.stringify({ "title": "Acer Predator Helios 300", "description": "Acer Predator Helios 300 is a gaming laptop", "color": "black", "price": 1499.99 })}</code>
                  <code>{JSON.stringify({ "index": { "_index": "products", "_id": "3" } })}</code>
                  <code>{JSON.stringify({ "title": "Alienware M15", "description": "Alienware M15 is a gaming laptop", "color": "gray", "price": 1999.99 })}</code>
                  <code>{JSON.stringify({ "index": { "_index": "products", "_id": "4" } })}</code>
                  <code>{JSON.stringify({ "title": "Ryzen 9 5950X", "description": "Ryzen 9 5950X is a high performance processor", "color": "black", "price": 899.99 })}</code>
                </pre>
                <h4>Best Practices</h4>
                <ul>
                  <li>Use bulk indexing for large datasets to improve performance</li>
                  <li>Define mappings before indexing to ensure proper data types</li>
                  <li>Choose meaningful index names and document IDs</li>
                </ul>

                <b>Note</b>: When indexing large amounts of data, remember to monitor your cluster's resources and adjust the bulk size accordingly. The optimal bulk size typically falls between 5-15MB per request.

              </div>
            </HelpPanel>
          </ExpandableSection>

          <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }]}>
            <div>
              <Button variant="primary" onClick={create_index}>Index Product catalog</Button>
            </div>
            <div>
              <Button variant="primary" onClick={delete_index}>Delete Product catalog</Button>
            </div>
          </Grid>

        </SpaceBetween>


      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(IndexDocumentPage)