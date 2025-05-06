import { useState, useEffect, useContext } from "react";
import { 
  Container, 
  Header, 
  Form, 
  FormField, 
  Input, 
  Button, 
  SpaceBetween, 
  Alert,
  ContentLayout,
  ExpandableSection,
  HelpPanel,
  Icon
} from '@cloudscape-design/components';
import { AuthHelper } from "../common/helpers/auth-help";
import axios from 'axios';
import { AppContext } from "../common/context";
import config from "../config.json";
import { FileUpload } from '@cloudscape-design/components';
import { AppPage } from "../common/types";
interface ProductForm {
  name: string;
  description: string;
  price: string;
  category: string;
  color: string;
}

export default function UploadProductPage(props: AppPage) {
    const appData = useContext(AppContext);
    const [formData, setFormData] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    category: '',
    color: ''
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileList, setFileList] = useState<File[]>([]);

  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      })
    }
    init();
  }, [])

  function build_form_data(result, formdata) {
    if ('fields' in result) {
      for (var key in result['fields']) {
        formdata.append(key, result['fields'][key])
      }
    }
    return formdata
  }

  const handleSubmit = async () => {
    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      const token = appData.userinfo.tokens.idToken.toString();
      // remove special characters from the filename
      const filename = fileList[0]?.name.replace(/[^a-zA-Z0-9]/g, '');
      // 1. Get presigned URL
      const presignedUrlResponse = await axios.post(config["apiUrl"] + "/presigned-url", {
        filename: filename,
        contentType: fileList[0]?.type,
      }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": token
        }
      });

      const formData1 = new FormData();
      build_form_data(presignedUrlResponse.data.result, formData1);
      formData1.append('file', fileList[0]);
      

      // 2. Upload image to S3
      await axios.post(presignedUrlResponse.data.result.url, formData1)

      // 3. Index product metadata
      const productData = {
        title: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        color: formData.color,
        file_name: presignedUrlResponse.data.result['fields'].key.split('/')[1]
      };

      await axios.post(config["apiUrl"] + '/index-custom-document', [productData], {
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        },
      });

      setSuccess('Product uploaded and indexed successfully!');
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        color: '',
        
      });
      setFileList([]);
    } catch (err) {
      setError('Failed to upload product. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
      header={
        <Header
          variant="h1"
          description="Add products to your catalog"
          actions={<Button iconName="settings" variant="icon" />}>
          Upload New Product
        </Header>
      }
    >
      <Container fitHeight>
        <ExpandableSection headerText="Guide to Product Uploads">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://opensearch.org/docs/latest/opensearch/index-data/">OpenSearch Indexing Documentation</a>
                  </li>
                </ul>
              </div>
            }
          >
            <div>
              <p>
                The <b>Upload Product</b> feature allows you to index new products to your catalog by providing product details and an image.
                When you upload a product, the following happens:
              </p>
              <ol>
                <li>The product image is uploaded to an S3 bucket</li>
                <li>The product metadata is indexed in OpenSearch</li>
                <li>The product becomes searchable through the search interfaces</li>
              </ol>
              <h4>Best Practices</h4>
              <ul>
                <li>Use descriptive product names and detailed descriptions for better search results</li>
                <li>Include accurate category and color information to improve filtering</li>
              </ul>
            </div>
          </HelpPanel>
        </ExpandableSection>
        
        <SpaceBetween size="l">
          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
        
        <Form
          actions={
            <Button 
              variant="primary" 
              onClick={handleSubmit}
              loading={uploading}
              disabled={fileList.length<=0 || !formData.name || !formData.price || !formData.category || !formData.color}
            >
              Upload Product
            </Button>
          }
        >
          <SpaceBetween size="l">
            <FormField label="Product Name">
              <Input
                value={formData.name}
                onChange={({ detail }) => setFormData({ ...formData, name: detail.value })}
                placeholder="Enter product name"
              />
            </FormField>

            <FormField label="Description">
              <Input
                value={formData.description}
                onChange={({ detail }) => setFormData({ ...formData, description: detail.value })}
                placeholder="Enter product description"
              />
            </FormField>

            <FormField label="Price">
              <Input
                value={formData.price}
                onChange={({ detail }) => setFormData({ ...formData, price: detail.value })}
                placeholder="Enter price"
                type="number"
                step={0.01}
              />
            </FormField>

            <FormField label="Color">
              <Input
                value={formData.color}
                onChange={({ detail }) => setFormData({ ...formData, color: detail.value })}
                placeholder="Enter color"
              />
            </FormField>
            <FormField label="Category">
              <Input
                value={formData.category}
                onChange={({ detail }) => setFormData({ ...formData, category: detail.value })}
                placeholder="Enter category"
              />
            </FormField>

            <FormField label="Product Image">
              <FileUpload
          accept=".png,.jpg,.webp,.gif"
          onChange={({ detail }) => {
            setFileList(detail.value)
          }
          }
          value={fileList}
          i18nStrings={{
            uploadButtonText: e =>
              e ? "Choose files" : "",
            dropzoneText: e =>
              e
                ? "Drop files to upload"
                : "Drop file to upload",
            removeFileAriaLabel: e =>
              `Remove file ${e + 1}`,
            limitShowFewer: "Show fewer files",
            limitShowMore: "Show more files",
            errorIconAriaLabel: "Error"
          }}
          showFileLastModified
          showFileSize
          showFileThumbnail
        />
            </FormField>
          </SpaceBetween>
        </Form>
      </SpaceBetween>
      </Container>
    </ContentLayout>
  );
} 