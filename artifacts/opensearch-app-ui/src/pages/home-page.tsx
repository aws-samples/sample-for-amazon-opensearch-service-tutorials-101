import {
  Container,
  ContentLayout,
  Box, Grid, ColumnLayout, SpaceBetween, Link
} from "@cloudscape-design/components";

export default function HomePage() {
  return (
    <ContentLayout
      defaultPadding
      disableOverlap
      headerBackgroundStyle={mode =>
        `center center/cover url("/images/header.png")`
      }
      header={
        <Box padding={{ vertical: "xxxl" }}>
          <Grid
            gridDefinition={[
              { colspan: { default: 12, s: 8 } }
            ]}
          >
            <Container>
              <Box padding="s">
                <Box
                  fontSize="display-l"
                  fontWeight="bold"
                  variant="h1"
                  padding="n"
                >
                  OpenSearch tutorial
                </Box>
                <Box
                  fontSize="display-l"
                  fontWeight="light"
                >
                  Search capabilities of OpenSearch
                </Box>
                <Box
                  variant="p"
                  color="text-body-secondary"
                  margin={{ top: "xs", bottom: "l" }}
                >
                  We demonstrate how to search/index with Opensearch
                </Box>
              </Box>
            </Container>
          </Grid>
        </Box>
      }
    >
      <SpaceBetween size="xxl">
        <Box>&nbsp;</Box>
        <Container>
          <ColumnLayout borders="vertical" columns={5}>
            <div>
              <Box padding="l" variant="h3">Prefix Match</Box>
              {/* <Box variant="p">Retrieval Augmented Generation Solution</Box> */}
            </div>
            <div>
              <Box padding="l" variant="h3">Multi Match</Box>
              {/* <Box variant="p">This solution comprises of multiple-generative AI agents working in tandem to solve a user-problem</Box> */}
            </div>
            <div>
              <Box padding="l" variant="h3">Minimum Should Match</Box>
              {/* <Box variant="p"></Box> */}
            </div>
            <div>
              <Box padding="l" variant="h3">Wildcard Match</Box>
              {/* <Box variant="p"></Box> */}
            </div>
            <div>
              <Box padding="l" variant="h3">Range Filter</Box>
              {/* <Box variant="p"></Box> */}
            </div>

            
          </ColumnLayout>
        </Container>

        <Container
      media={{
        content: (
          <img
            src="/images/document-chat.png"
            alt="placeholder"
          />
        ),
        position: "side",
        width: "14%"
      }}
    >
      <SpaceBetween direction="vertical" size="s">
        <SpaceBetween direction="vertical" size="xxs">
          <Box variant="h2">
            <Link fontSize="heading-m" href="#/keyword-search/prefix-match">
              Prefix Match
            </Link>
          </Box>
        </SpaceBetween>
        <Box variant="p">
        Find documents containing terms that begin with a specified string - perfect for implementing autocomplete or type-ahead functionality.
        </Box>
      </SpaceBetween>
    </Container>


    <Container
      media={{
        content: (
          <img
            src="/images/multi-agent.png"
            alt="placeholder"
          />
        ),
        position: "side",
        width: "14%"
      }}
    >
      <SpaceBetween direction="vertical" size="s">
        <SpaceBetween direction="vertical" size="xxs">
          <Box variant="h2">
            <Link fontSize="heading-m" href="#/keyword-search/multi-match">
              Multi Match
            </Link>
          </Box>
        </SpaceBetween>
        <Box variant="p">
        Search across multiple document fields simultaneously with a single query, with the ability to prioritize certain fields using boosting (^)
        </Box>
      </SpaceBetween>
    </Container>



    <Container
      media={{
        content: (
          <img
            src="/images/sentiment.png"
            alt="placeholder"
          />
        ),
        position: "side",
        width: "14%"
      }}
    >
      <SpaceBetween direction="vertical" size="s">
        <SpaceBetween direction="vertical" size="xxs">
          <Box variant="h2">
            <Link fontSize="heading-m" href="#/keyword-search/minimum-should-match">
              Minimum Should Match
            </Link>
          </Box>
        </SpaceBetween>
        <Box variant="p">
            Control search precision by specifying how many query terms must appear in a document for it to be included in results.
        </Box>
      </SpaceBetween>
    </Container>



    <Container
      media={{
        content: (
          <img
            src="/images/ocr.png"
            alt="placeholder"
          />
        ),
        position: "side",
        width: "14%"
      }}
    >
      <SpaceBetween direction="vertical" size="s">
        <SpaceBetween direction="vertical" size="xxs">
          <Box variant="h2">
            <Link fontSize="heading-m" href="#/keyword-search/wildcard-match">
              Wildcard Match
            </Link>
          </Box>
        </SpaceBetween>
        <Box variant="p">
        Search using pattern matching with special operators like * (matches zero or more characters) and ? (matches exactly one character)
        </Box>
      </SpaceBetween>
    </Container>

    <Container
      media={{
        content: (
          <img
            src="/images/ocr.png"
            alt="placeholder"
          />
        ),
        position: "side",
        width: "14%"
      }}
    >
      <SpaceBetween direction="vertical" size="s">
        <SpaceBetween direction="vertical" size="xxs">
          <Box variant="h2">
            <Link fontSize="heading-m" href="#/keyword-search/range-filter">
              Range Filter
            </Link>
          </Box>
        </SpaceBetween>
        <Box variant="p">
        Find documents where field values fall within specific boundaries using operators like gte (greater than or equal to), lte (less than or equal to), gt (greater than), and lt (less than)
        </Box>
      </SpaceBetween>
    </Container>


      </SpaceBetween>

    </ContentLayout>
  );
}
