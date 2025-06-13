import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import Link from "@cloudscape-design/components/link";
import * as React from "react";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import Cards from "@cloudscape-design/components/cards";
import Box from "@cloudscape-design/components/box";
import Grid from "@cloudscape-design/components/grid";
import HelpPanel from "@cloudscape-design/components/help-panel";


import {
  Container,
  ContentLayout,
  Header, Button,
  SpaceBetween,
  Checkbox,
  Icon,
  ExpandableSection,
  Select,
  Slider,
  Alert,
  Input
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

function KeywordMultiPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [value, setValue] = React.useState("");
  
  const [searchByTitle, setSearchByTitle] = React.useState(true);
  const [searchByDescription, setSearchByDescription] = React.useState(true);
  const [searchByColor, setSearchByColor] = React.useState(true);
  const [searchByPrice, setSearchByPrice] = React.useState(false);

  const [titleBoost, setTitleBoost] = React.useState(0);
  const [descriptionBoost, setDescriptionBoost] = React.useState(0);
  const [colorBoost, setColorBoost] = React.useState(0);
  const [priceBoost, setPriceBoost] = React.useState(0);
  
  const [suggestions, setSuggestions] = React.useState([{}]);
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
        // Add the text before the match
        result += text.slice(lastIndex, currentIndex);
        // Add the bold-wrapped original case of the matched text
        result += `<b>${text.slice(currentIndex, currentIndex + search_value.length)}</b>`;
        lastIndex = currentIndex + search_value.length;
    }
    
    // Add any remaining text
    result += text.slice(lastIndex);
    
    return result;
  }

  const handle_notifications = (message, notify_type) => {
    setAlertMsg(message)
    setAlertType(notify_type)
    setShowAlert(true)
  }


  // function highlighter(text: string, search_value:string) {
  //   var regEx = new RegExp(search_value, "ig");
  //   var isPresent = String(text).toLowerCase().includes(search_value.toLowerCase())
  //   if (!isPresent) {
  //     return text;
  //   } else {
  //     text = text.replace(regEx, `<b>${search_value}</b>`)
  //   }
  //   return text;       
  // }

  async function multi_match() {
    if (value.length < 3) {
      handle_notifications("Search term must be at least 3 characters long", "warning");
      return;
    }

    const token = appData.userinfo.tokens.idToken.toString();
    const fields = []
    const key = "None"
    if (searchByTitle){
      fields.push({"field": "title", "boost": titleBoost})
    }
    if (searchByDescription){
      fields.push({"field": "description", "boost": descriptionBoost})
    }
    if (searchByColor){
      fields.push({"field": "color", "boost": colorBoost})
    }
    if (searchByPrice){
      fields.push({"field": "price", "boost": priceBoost})
    }
    // call api gateway and pass in the value and set Authorization header
    const response = await fetch(config["apiUrl"] + "/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({
        "attribute_name": key,
        "attribute_value": value,
        "type": "multi_match",
        "fields": fields
      })
    });
    var itms = []
    if (response.ok) {
      // read the response body
      const resp = await response.json();
      const arr = resp['result']['hits']['hits']

      // set the value of the input box to the first result
      // load cards here
      for (let i = 0; i < arr.length; i++) {
          // get the _source
          const source = arr[i]['_source']
          // get the title
          const title = source['title']
          
          itms.push({
            name: highlighter(title, value),
            title: title,
            description: highlighter(source['description'], value),
            color: highlighter(source['color'], value),
            price: "$" + highlighter(String(source['price']), String(value)),
            image_url: source['image_url']
          })
        }
      setItems(itms)
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
        
        <ExpandableSection headerText="Guide to Multi Match Search">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://opensearch.org/docs/latest/query-dsl/full-text/multi-match/">Link to documentation</a>
                  </li>
                </ul>
              </div>
            }
            
          >
            <div>
              <p>
              A multi-match operation is an advanced search feature in Opensearch that allows you to search across multiple fields simultaneously.
              It's particularly useful when you want to find relevant results in different parts of your documents.
              The <b>^</b> symbol “boosts” certain fields. Boosting increases the importance of matches in the boosted field. For example <b>"field^2"</b> gives that field twice the importance of other fields.
              </p>
              <h4>Prerequisites</h4>
              <ul>
                <li><a href="#/index-documents">Index your documents</a> into OpenSearch first</li>
              </ul>
              <p>
                <b>In our example</b>, lets search for "Pink" across three fields: <i>title, description, color</i>. 
                Use the slider to boost the <b>color</b> field by 4, making matches in this field four times more significant. You can try out various combinations here.
                The generated multi-match query would look as follows, try:
                
              </p>
              <pre>
                  <code>{
                  JSON.stringify({"query": {
                    "multi_match": {
                      "query": "Red",
                      "fields": ["title", "description", "color^4", "price"]
                    }
                  }
                })
                }</code>
                </pre>
              <h4>Best Practices</h4>
              <ul>
                <li>Choose fields that are logically related for better results</li>
                <li>Use boosting judiciously to maintain result relevance</li>
              </ul>

            </div>
          </HelpPanel>
        </ExpandableSection>

        <Grid gridDefinition={[{ colspan: 2 }, { colspan: 2 }, { colspan: 2 }]}>
          <div>
            <Checkbox onChange={({ detail }) => setSearchByTitle(detail.checked)} checked={searchByTitle}>Title</Checkbox>
            <Slider onChange={({ detail }) => setTitleBoost(detail.value)} value={titleBoost} max={10} min={0} />
          </div>
          <div>
            <Checkbox onChange={({ detail }) => setSearchByDescription(detail.checked)} checked={searchByDescription}>Description</Checkbox>
            <Slider onChange={({ detail }) => setDescriptionBoost(detail.value)} value={descriptionBoost} max={10} min={0} />
          </div>
          <div>
            <Checkbox onChange={({ detail }) => setSearchByColor(detail.checked)} checked={searchByColor}>Color</Checkbox>
            <Slider onChange={({ detail }) => setColorBoost(detail.value)} value={colorBoost} max={10} min={0} />
          </div>
          {/* <div>
            <Checkbox onChange={({ detail }) => setSearchByPrice(detail.checked)} checked={searchByPrice}>Price</Checkbox>
            <Slider onChange={({ detail }) => setPriceBoost(detail.value)} value={priceBoost} max={10} min={0} />
          </div> */}

        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <div>
          <Input
              value={value}
              onChange={({ detail }) => setValue(detail.value)}
              placeholder="A Multi-Match search across title, description, color, price"
            />
        </div>
        <div>
          <Button variant="primary" onClick={multi_match}>
            Search
          </Button>
        </div>
        <div style={{ marginTop: "2vh" }}>
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
        </div>
        </Grid>
      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(KeywordMultiPage)