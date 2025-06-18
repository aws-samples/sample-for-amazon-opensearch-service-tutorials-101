import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import {
  Container,
  ContentLayout,
  Header,
  Button,
  SpaceBetween,
  Alert,
  Grid,
  ExpandableSection,
  HelpPanel,
  Icon,
  ProgressBar
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

function VectorIndexPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState<"error" | "success" | "warning" | "info">("error");
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      });
    };
    init();
  }, []);

  const handle_notifications = (message: string, notify_type: "error" | "success" | "warning" | "info") => {
    setAlertMsg(message);
    setAlertType(notify_type);
    setShowAlert(true);
  };

  async function deleteVectorIndexing() {
    setShowAlert(false);
    const token = appData.userinfo.tokens.idToken.toString();

    // Trigger Index API
    try {
        const response = await fetch(config["apiUrl"] + "/vectorize-index", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token
          },
          body: JSON.stringify({})
        });
  
        const result = await response.json();
        
        if (response.ok) {
          handle_notifications("Product catalog vector index deleted", "success");
        } else {
          handle_notifications("Product catalog vector index deletion failed: " + result.errorMessage, "error");
        }
      } catch (err) {
        handle_notifications("Product catalog vector index deletion failed: " + err, "error");
        console.error(err);
      }
  }

  async function performVectorIndexing() {
    setIsIndexing(true);
    setProgress(0);
    const token = appData.userinfo.tokens.idToken.toString();

    try {
      const response = await fetch(config["apiUrl"] + "/vectorize-index", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        }
      });

      if (response.ok) {
        const resp = await response.json();
        if (resp.success) {
          handle_notifications("Successfully indexed products with vector embeddings", "success");
        } else {
          handle_notifications(resp.errorMessage || "Failed to index products", "error");
        }
      } else {
        const error_resp = await response.json();
        handle_notifications("Failed to index products: " + error_resp["errorMessage"], "error");
      }
    } catch (error) {
      handle_notifications("Error during indexing: " + error, "error");
    } finally {
      setIsIndexing(false);
      setProgress(100);
    }
  }

  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
      header={
        <Header
          variant="h1"
          description="Index products with vector embeddings for semantic search"
          actions={<Button iconName="settings" variant="icon" />}>
          Vector Index
        </Header>
      }
    >
      <Container fitHeight>
        {showAlert && (
          <Alert
            dismissible
            statusIconAriaLabel={alertType}
            type={alertType}
            onDismiss={() => setShowAlert(false)}
          >
            {alertMsg}
          </Alert>
        )}

        <ExpandableSection headerText="Guide to Vector Indexing (In-Memory and On-Disk)">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://docs.opensearch.org/docs/latest/vector-search/ai-search/semantic-search/">Semantic Search Documentation</a>
                  </li>
                  <li>
                    <a href="https://docs.opensearch.org/docs/latest/vector-search/optimizing-storage/disk-based-vector-search/">On-Disk Mode Documentation</a>
                  </li>
                  <li>
                    <a href="https://opensearch.org/blog/reduce-cost-with-disk-based-vector-search/">On-Disk Mode Blog-1</a>
                  </li>
                  <li>
                    <a href="https://aws.amazon.com/blogs/big-data/opensearch-vector-engine-is-now-disk-optimized-for-low-cost-accurate-vector-search/">On-Disk Mode Blog-2</a>
                  </li>
                </ul>
              </div>
            }
          >
            <div>
              <p>
                <b>Vector indexing</b> converts your product data into vector embeddings using the Cohere embed-english-v3 model on Amazon Bedrock. 
                These embeddings capture the semantic meaning of your product descriptions, enabling semantic search capabilities.
                In our example we've created two vector indexes. One lives in memory and the other on disk.
                <ul>
                  <li><b>In-Memory Mode</b> is used to search the vector index in memory. It is faster than <b>On-Disk Mode</b> as the KNN graph resides in memory.</li>
                  <li><b>On-Disk Mode</b> is used to search the vector index on the disk. It is slower than <b>In-Memory Mode</b> because it works in two phases. First it searches the compressed in-memory index for candidates. Then it retrieves full-precision vectors from disk to re-score results.</li>
                </ul>
              </p>
              <h4>Process</h4>
              <ol>
                <li>Reads products from the existing index</li>
                <li>Combines relevant fields (title, color, category, description)</li>
                <li>Generates embeddings using Cohere model</li>
                <li>Indexes products with embeddings into a new vector index</li>
              </ol>
              <h4>Prerequisites</h4>
              <ul>
                <li>Access to Cohere embed English v3 model on Amazon Bedrock</li>
              </ul>
            </div>
          </HelpPanel>
        </ExpandableSection>

        <div style={{ height: "2vh" }} />

        <SpaceBetween size="l">
          <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }]}>
          <Button 
            variant="primary" 
            onClick={performVectorIndexing}
            disabled={isIndexing}
          >
            {isIndexing ? "Indexing..." : "Start Vector Indexing"}
          </Button>
          <Button 
            variant="primary" 
            onClick={deleteVectorIndexing}
            disabled={isIndexing}
          >
            Delete Vector Index
          </Button>
          </Grid>

          {isIndexing && (
            <ProgressBar
              value={progress}
              label="Indexing Progress"
              description="Converting products to vector embeddings"
            />
          )}
        </SpaceBetween>
      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(VectorIndexPage); 