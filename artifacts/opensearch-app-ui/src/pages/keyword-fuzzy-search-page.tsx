import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import * as React from "react";
import {
  Container,
  ContentLayout,
  Header,
  Button,
  SpaceBetween,
  FormField,
  Input,
  Cards,
  Box,
  Alert,
  ExpandableSection,
  HelpPanel,
  Icon
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

function FuzzySearchPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [searchValue, setSearchValue] = useState("");
  const [items, setItems] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState<"error" | "success" | "warning" | "info">("error");

  const SafeHtml = ({ html }: { html: string }) => {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      });
    };
    init();
  }, []);

  function highlighter(text: string, search_value: string) {
    if (!search_value || !text) {
      return text;
    }

    const lowerText = text.toLowerCase();
    const lowerSearch = search_value.toLowerCase();

    if (!lowerText.includes(lowerSearch)) {
      return text;
    }

    let result = '';
    let lastIndex = 0;
    let currentIndex = 0;

    while ((currentIndex = lowerText.indexOf(lowerSearch, lastIndex)) !== -1) {
      result += text.slice(lastIndex, currentIndex);
      result += `<b>${text.slice(currentIndex, currentIndex + search_value.length)}</b>`;
      lastIndex = currentIndex + search_value.length;
    }

    result += text.slice(lastIndex);
    return result;
  }

  const handle_notifications = (message: string, notify_type: "error" | "success" | "warning" | "info") => {
    setAlertMsg(message);
    setAlertType(notify_type);
    setShowAlert(true);
  };

  async function performFuzzySearch() {
    if (searchValue.length < 2) {
      handle_notifications("Search term must be at least 2 characters long", "warning");
      return;
    }

    const token = appData.userinfo.tokens.idToken.toString();

    const queryBody = {
      type: "complex_search",
      search_value: searchValue,
      search_type: "fuzzy",
      fields: []
    };

    try {
      const response = await fetch(config["apiUrl"] + "/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        },
        body: JSON.stringify(queryBody)
      });

      if (response.ok) {
        const resp = await response.json();
        const arr = resp['result']['hits']['hits'];

        const itms = arr.map((hit: any) => {
          const source = hit['_source'];
          return {
            name: highlighter(source['title'], searchValue),
            title: source['title'],
            description: highlighter(source['description'], searchValue),
            color: highlighter(source['color'], searchValue),
            price: "$" + highlighter(String(source['price']), String(searchValue)),
            image_url: source['image_url']
          };
        });

        setItems(itms);
      } else {
          handle_notifications("Index not found, please index the product catalog first", "error")
        
      }
    } catch (error) {
      handle_notifications("Error performing search: " + error, "error");
    }
  }

  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
      header={
        <Header
          variant="h1"
          description="Search with fuzzy matching to handle typos and similar words"
          actions={<Button iconName="settings" variant="icon" />}>
          Fuzzy Search
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

        <ExpandableSection headerText="Guide to Fuzzy Search">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://docs.opensearch.org/docs/latest/query-dsl/term/fuzzy/">Link to documentation</a>
                  </li>
                </ul>
              </div>
            }
          >
            <div>
              <p>
                <b>Fuzzy search</b> in OpenSearch helps you find documents even when search terms contain typos or misspellings. It works by finding terms similar to your search term within a specified edit distance (Damerau-Levenshtein distance), which counts character changes like replacements, insertions, deletions, and transpositions.
              </p>
              <p>
                <b>In our example</b>, let's search for "HALET" (a misspelling of "HAMLET") in a collection of literary works. The fuzzy query will match documents containing "HAMLET" despite the spelling error:
              </p>
              <pre>
                  {JSON.stringify({
                    "query": {
                      "multi_match": {
                        "query": "shooz",
                        "fields": ["title^3", "description^2", "color"],
                        "fuzziness": "AUTO",
                        "prefix_length": 2
                      }
                    }
                  }, null, 2)}
              </pre>
              <h4>Key Parameters</h4>
              <ul>
                <li><b>fuzziness</b>: Controls the maximum edit distance (AUTO is recommended and adjusts based on term length)</li>
                <li><b>max_expansions</b>: Limits how many variations the query will consider (default 50)</li>
                <li><b>prefix_length</b>: Number of beginning characters that must match exactly (default 0)</li>
                <li><b>fuzzy_transpositions</b>: When true (default), allows character swaps as single edit operations</li>
              </ul>
              <h4>Best Practices</h4>
              <ul>
                <li>Use fuzzy search for user interfaces where typing errors are common</li>
                <li>Start with the AUTO fuzziness setting before manually adjusting</li>
                <li>Increase prefix_length to improve performance and reduce false positives</li>
                <li>Adjust max_expansions based on your index size and performance requirements</li>
              </ul>
            </div>
          </HelpPanel>
        </ExpandableSection>

        <div style={{ height: "2vh" }} />

        <SpaceBetween size="l">
          <FormField label="Search Term">
            <Input
              value={searchValue}
              onChange={({ detail }) => setSearchValue(detail.value)}
              placeholder="Enter search term (fuzzy matching enabled)..."
            />
          </FormField>

          <Button variant="primary" onClick={performFuzzySearch}>
            Search
          </Button>

          <Cards
            cardDefinition={{
              header: item => <SafeHtml html={item.name} />,
              sections: [
                {
                  id: "description",
                  header: "Description",
                  content: item => (
                    <div 
                      style={{ 
                        marginTop: '20px', 
                        marginBottom: '10px',
                        fontFamily: "'Tangerine', 'Brush Script MT', cursive",
                        fontSize: '1.5rem',
                        lineHeight: '1.6',
                        color: '#333',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                        padding: '10px',
                        background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0.7))',
                        borderRadius: '8px',
                        maxHeight: '200px',
                        overflow: 'auto'
                      }}
                    >
                      <SafeHtml html={item.description} />
                    </div>
                    )
                },
                {
                  id: "color",
                  header: "Color",
                  content: item => <SafeHtml html={item.color} />
                },
                {
                  id: "price",
                  header: "Price",
                  content: item => <SafeHtml html={item.price} />
                },
                {
                  id: "image",
                  header: "Image",
                  content: item => (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      style={{ maxWidth: "100%", height: "auto" }}
                    />
                  )
                }
              ]
            }}
            cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }]}
            items={items}
            loadingText="Loading resources"
            trackBy="title"
            empty={
              <Box textAlign="center" color="inherit">
                <b>No resources</b>
                <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                  No resources to display.
                </Box>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(FuzzySearchPage); 