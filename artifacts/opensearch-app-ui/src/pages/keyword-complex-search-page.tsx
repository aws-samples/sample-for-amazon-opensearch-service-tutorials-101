import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import * as React from "react";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import Cards from "@cloudscape-design/components/cards";
import Box from "@cloudscape-design/components/box";
import Grid from "@cloudscape-design/components/grid";
import HelpPanel from "@cloudscape-design/components/help-panel";
import {
  Container,
  ContentLayout,
  Header,
  Button,
  SpaceBetween,
  Checkbox,
  Icon,
  ExpandableSection,
  Select,
  Slider,
  Alert,
  FormField,
  Input,
  RadioGroup,
  Tabs
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

// Define field types
type FieldType = 'text' | 'number' | 'select' | 'range';

interface SearchField {
  name: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string }[];
  boost?: number;
}

// Define available search fields
const searchFields: SearchField[] = [
  {
    name: "title",
    label: "Title",
    type: "text",
    boost: 3
  },
  {
    name: "description",
    label: "Description",
    type: "text",
    boost: 2
  },
  {
    name: "category",
    label: "Category",
    type: "select",
    options: [
      { label: "All", value: "" },
      { label: "Women", value: "women" },
      { label: "Men", value: "men" },
      { label: "Unisex", value: "unisex" }
    ]
  },
  {
    name: "color",
    label: "Color",
    type: "text"
  },
  {
    name: "price",
    label: "Price",
    type: "range"
  }
];

function ComplexSearchPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [searchValue, setSearchValue] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [searchType, setSearchType] = useState("combined");
  const [activeTab, setActiveTab] = useState("text");
  
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

  const handleFieldChange = (fieldName: string, value: any) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const renderFieldInput = (field: SearchField) => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            value={fieldValues[field.name] || ""}
            onChange={({ detail }) => handleFieldChange(field.name, detail.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        );
      case 'select':
        return (
          <Select
            selectedOption={fieldValues[field.name] ? { label: fieldValues[field.name], value: fieldValues[field.name] } : null}
            onChange={({ detail }) => handleFieldChange(field.name, detail.selectedOption.value)}
            options={field.options || []}
            placeholder={`Select ${field.label.toLowerCase()}`}
          />
        );
      case 'range':
        return (
          <SpaceBetween size="s">
            <Input
              type="number"
              value={fieldValues[`${field.name}_min`] || ""}
              onChange={({ detail }) => handleFieldChange(`${field.name}_min`, Number(detail.value))}
              placeholder="Min"
            />
            <Input
              type="number"
              value={fieldValues[`${field.name}_max`] || ""}
              onChange={({ detail }) => handleFieldChange(`${field.name}_max`, Number(detail.value))}
              placeholder="Max"
            />
          </SpaceBetween>
        );
      default:
        return null;
    }
  };

  async function performComplexSearch() {
    if (searchValue.length < 3) {
      handle_notifications("Search term must be at least 3 characters long", "warning");
      return;
    }

    const token = appData.userinfo.tokens.idToken.toString();
    
    // Build the complex query based on search type
    let queryBody = {
      type: "complex_search",
      search_value: searchValue,
      search_type: searchType,
      fields: searchFields.map(field => ({
        name: field.name,
        type: field.type,
        boost: field.boost,
        value: field.type === 'range' 
          ? {
              min: fieldValues[`${field.name}_min`],
              max: fieldValues[`${field.name}_max`]
            }
          : fieldValues[field.name]
      })).filter(field => field.value !== undefined && field.value !== "")
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
          description="Advanced search capabilities combining multiple search types"
          actions={<Button iconName="settings" variant="icon" />}>
          Complex Search
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

        <ExpandableSection headerText="Guide to Complex Search">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://opensearch.org/docs/latest/query-dsl/compound/bool/">Link to documentation</a>
                  </li>
                </ul>
              </div>
            }
          >
            <div>
              <p>
                Complex search allows you to combine multiple search criteria to find exactly what you're looking for.
                You can search across multiple fields with different types of matching.
              </p>
              
                <b>Search Types:</b>
                <ul>
                  <li><b>Combined:</b> Matches all criteria (AND)</li>
                  <li><b>Any:</b> Matches any criteria (OR)</li>
                  <li><b>Exact:</b> Matches exact phrases</li>
                </ul>
              
              <p>
                <b>In our example</b>, lets search for "Shoes" in the search term and combine it with "cross-training" across title. You could also look for "red" shoes by combining "red" in the color field  with "shoes" in the search term.
              You could also try out a combination of filters/Text fields and the search term. For example, you could search for "pink" colored shoes in the "womens" category in a price range of 1000 to 15000.
              
              </p>

                <b>Example Queries:</b>
                <br/>
                <br/>
                <b>1. Combined Search (AND):</b>
                <pre>
                  {JSON.stringify({
                    "query": {
                      "bool": {
                        "must": [
                          {
                            "multi_match": {
                              "query": "leather",
                              "fields": ["title^3", "description^2", "color"],
                              "type": "best_fields"
                            }
                          },
                          {
                            "term": {
                              "category": "women"
                            }
                          },
                          {
                            "range": {
                              "price": {
                                "gte": 5000,
                                "lte": 15000
                              }
                            }
                          }
                        ]
                      }
                    }
                  }, null, 2)}
                </pre>
                <br/>
                <b>2. Any Search (OR):</b>
                <pre>
                  {JSON.stringify({
                    "query": {
                      "bool": {
                        "must": [
                          {
                            "multi_match": {
                              "query": "leather",
                              "fields": ["title^3", "description^2", "color"],
                              "type": "best_fields"
                            }
                          }
                        ],
                        "should": [
                          {
                            "term": {
                              "category": "women"
                            }
                          },
                          {
                            "range": {
                              "price": {
                                "gte": 5000,
                                "lte": 15000
                              }
                            }
                          }
                        ],
                        "minimum_should_match": 1
                      }
                    }
                  }, null, 2)}
                </pre>
                <br/>
                <b>3. Exact Search:</b>
                <pre>
                  {JSON.stringify({
                    "query": {
                      "bool": {
                        "must": [
                          {
                            "multi_match": {
                              "query": "leather shoes",
                              "fields": ["title^3", "description^2", "color"],
                              "type": "phrase"
                            }
                          },
                          {
                            "term": {
                              "category": "women"
                            }
                          }
                        ]
                      }
                    }
                  }, null, 2)}
                </pre>
                <br/>
                <b>Field Types:</b>
                <ul>
                  <li><b>Text:</b> Full-text search with optional boosting</li>
                  <li><b>Select:</b> Exact term matching (e.g., category)</li>
                  <li><b>Range:</b> Numeric range queries (e.g., price)</li>
                </ul>
                <br/>
                <b>Field Boosting:</b>
                <ul>
                  <li>Title: 3x boost (^3)</li>
                  <li>Description: 2x boost (^2)</li>
                  <li>Color: 1x boost (default)</li>
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
              placeholder="Enter search term..."
            />
          </FormField>

          <Tabs
            tabs={[
              {
                label: "Text Fields",
                id: "text",
                content: (
                  <SpaceBetween size="l">
                    {searchFields
                      .filter(field => field.type === 'text')
                      .map(field => (
                        <FormField key={field.name} label={field.label}>
                          {renderFieldInput(field)}
                        </FormField>
                      ))}
                  </SpaceBetween>
                )
              },
              {
                label: "Filters",
                id: "filters",
                content: (
                  <SpaceBetween size="l">
                    {searchFields
                      .filter(field => field.type === 'select' || field.type === 'range')
                      .map(field => (
                        <FormField key={field.name} label={field.label}>
                          {renderFieldInput(field)}
                        </FormField>
                      ))}
                  </SpaceBetween>
                )
              }
            ]}
            activeTabId={activeTab}
            onChange={({ detail }) => setActiveTab(detail.activeTabId)}
          />

          <FormField label="Search Type">
            <RadioGroup
              value={searchType}
              onChange={({ detail }) => setSearchType(detail.value)}
              items={[
                { label: "Combined (AND)", value: "combined" },
                { label: "Any (OR)", value: "any" },
                { label: "Exact", value: "exact" }
              ]}
            />
          </FormField>

          <Button variant="primary" onClick={performComplexSearch}>
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

export default withAuthenticator(ComplexSearchPage); 