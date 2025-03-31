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

  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      })
    }
    init();
  }, [])

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
          const title = source['title']
          // add to suggestions
          suggestns.push({ value: title })
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
            price: "$" + source['price']
          })
        }
        setItems(itms)

      }


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
              <Link href="#" fontSize="heading-m">
                {item.name}
              </Link>
            ),
            sections: [
              {
                id: "description",
                header: "Description",
                content: item => item.description
              },
              {
                id: "color",
                header: "Color",
                content: item => item.color
              },
              {
                id: "price",
                header: "Price",
                content: item => item.price
              }
            ]
          }}
            cardsPerRow={[
              { cards: 1 },
              { minWidth: 500, cards: 1 }
            ]}
            items={items}
            loadingText="Loading products"
            visibleSections={["title", "description", "color", "price"]}
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