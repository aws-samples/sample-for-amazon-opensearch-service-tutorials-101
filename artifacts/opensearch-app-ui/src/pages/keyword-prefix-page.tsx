import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import Link from "@cloudscape-design/components/link";
import * as React from "react";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import Cards from "@cloudscape-design/components/cards";
import Box from "@cloudscape-design/components/box";
import Grid from "@cloudscape-design/components/grid";


import {
  Container,
  ContentLayout,
  Header, Button,
  SpaceBetween,
  ExpandableSection,
  HelpPanel,
  Icon,
  Alert,
  RadioGroup
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

function KeywordPrefixPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [value, setValue] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [search_field, setSearchField] = React.useState("title");
  const [items, setItems] = React.useState([]);
  const [showAlert, setShowAlert] = React.useState(false)
  const [alertMsg, setAlertMsg] = React.useState("")
  const [alertType, setAlertType] = React.useState("error")

  const SafeHtml = ({ html }: { html: string }) => {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

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

  async function prefix_match(search_value: string, canSuggest: boolean, keydown?: any) {
    if (search_value == null) {
      // load all results
      search_value = value
    }
    
    setValue(search_value);
    
    const token = appData.userinfo.tokens.idToken.toString();
    // call api gateway and pass in the value and set Authorization header
    const response = await fetch(config["apiUrl"] + "/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({
        "attribute_name": search_field,
        "attribute_value": search_value,
        "type": "prefix_match"
      })
    });
    var suggestns = []
    var itms = []
    if (response.ok) {
      // read the response body
      const resp = await response.json();
      const arr = resp['result']['hits']['hits']

      if (canSuggest) {
        // iterate over arr
        for (let i = 0; i < arr.length; i++) {
          // get the _source
          const source = arr[i]['_source']
          // get the title
          const auto_suggest_field = source[search_field]
          // add to suggestions
          suggestns.push({ value: auto_suggest_field })
        }
        setSuggestions(suggestns)
      }
      else {

        // set the value of the input box to the first result
        // load cards here
        for (let i = 0; i < arr.length; i++) {
          // get the _source
          const source = arr[i]['_source']
          // get the title
          const title = source['title']
          // add to suggestions
          suggestns.push({ value: title })
          itms.push({
            name: title,
            description: source['description'],
            color: source['color'],
            price: "$" + source['price'],
            image_url: source['image_url']
          })
        }
        setItems(itms)

      }


    } else {
      handle_notifications("Index not found, please index the product catalog first", "error")
    }

  }

  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
      header={
        <Header
          variant="h1"
          description="Query your Opensearch datastore"
          actions={<Button iconName="settings" variant="icon" />}>
          Keyword Search
        </Header>
      }
    >
      <Container fitHeight
      >
        {(showAlert && alertType == 'error') ? <Alert dismissible statusIconAriaLabel="Error" type='error' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'success') ? <Alert dismissible statusIconAriaLabel="Success" type='success' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'warning') ? <Alert dismissible statusIconAriaLabel="Warning" type='warning' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
        {(showAlert && alertType == 'info') ? <Alert dismissible statusIconAriaLabel="Info" type='info' onDismiss={() => setShowAlert(false)}>{alertMsg}</Alert> : ""}
      
        <ExpandableSection headerText="Guide to Prefix-Match Search">
                  <HelpPanel
                    footer={
                      <div>
                        <h3>
                          Learn more{" "}
                          <Icon name="external" size="inherit" />
                        </h3>
                        <ul>
                          <li>
                            <a href="https://opensearch.org/docs/latest/query-dsl/full-text/match-phrase-prefix/">Link to documentation</a>
                          </li>
                        </ul>
                      </div>
                    }
                    
                  >
                    <div>
                      <p>
                      A prefix search in Opensearch allows you to find documents that contain terms starting with a specified prefix.
                      It's especially useful when you want to implement type-ahead or autocomplete functionality, or when you're not sure of the exact complete term.
                      The match_phrase_prefix query matches documents where the specified field contains terms in the exact order, with the last term treated as a prefix.
                      </p>
                      <h4>Prerequisites</h4>
                        <ul>
                          <li><a href="#/index-documents">Index your documents</a> into OpenSearch first</li>
                        </ul>
                      <p>
                        <b>In our example</b>, let's search for "Pink" in the title field. When you type "Pi", it will match products with titles containing words that start with "Pi" (like "Pink", "Pillow", "Picture"). You can try different prefixes here. The generated prefix query would look as follows:
                      </p>
                      <pre>
                          <code>{
                          JSON.stringify({"query": {
                            "match_phrase_prefix": {
                              "title": "Pink",
                              "max_expansions": 10,
                              "slop": 1
                            }
                          }
                        })
                        }</code>
                        </pre>
                      <h4>Best Practices</h4>
                      <ul>
                        <li>Limit the prefix length to improve performance</li>
                        <li>Use max_expansions parameter to control the number of matching terms</li>
                      </ul>
                      <p><b>Note</b>: Prefix queries can be resource-intensive on large datasets because they need to scan many terms.
                        The max_expansions parameter (default: 50) helps limit the number of examined terms.</p>
        
                    </div>
                  </HelpPanel>
        </ExpandableSection>
        
        <div>
          <h3>Select your search field</h3>
        </div>

        <Grid gridDefinition={[{ colspan: 4 }]}>
        <div>
          <RadioGroup onChange={({ detail }) => setSearchField(detail.value)} value={search_field} 
            items={[
              { value: "title", label: "Title"},
              { value: "description", label: "Description" },
              { value: "color", label: "Color" }
              ]}
         />
        </div>
        </Grid>
        
        <Grid gridDefinition={[{ colspan: 12 }]}>

          <Autosuggest
            onChange={({ detail }) => prefix_match(detail.value, true)}
            value={value}
            options={suggestions}
            onSelect={({ detail }) => prefix_match(detail.selectedOption.value, false)}
            onKeyDown={({ detail }) => prefix_match(null, false, detail)}
            ariaLabel="Autosuggest example with suggestions"
            placeholder="A Prefix search on Products e.g. Categories - Bag / Shoes, Color - Red / Pink"
            empty="No matches found"
          />

          <Cards cardDefinition={{
            header: item => (
              <div>
              <Link fontSize="heading-m">
                <SafeHtml html={item.name} />
              </Link>
              
            </div>
            ),
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
            cardsPerRow={[
              { cards: 1 },
              { minWidth: 500, cards: 2 }
            ]}
            items={items}
            loadingText="Loading products"
            visibleSections={["title", "description", "color", "price", "image"]}
            empty={
              <Box
                margin={{ vertical: "xs" }}
                textAlign="center"
                color="inherit"
              >
                <SpaceBetween size="m">
                  <b>No resources</b>

                </SpaceBetween>
              </Box>
            }
          />
        </Grid>
      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(KeywordPrefixPage)