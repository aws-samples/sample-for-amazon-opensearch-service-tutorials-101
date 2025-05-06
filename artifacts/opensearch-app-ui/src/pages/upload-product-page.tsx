import { useState, useEffect, useContext } from "react";
import { Container, Header, Form, FormField, Input, Button, SpaceBetween, Alert } from '@cloudscape-design/components';
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

  const handleSubmit = async () => {
    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      const token = appData.userinfo.tokens.idToken.toString();

      // 1. Get presigned URL
      const presignedUrlResponse = await axios.post(config["apiUrl"] + "/presigned-url", {
        filename: fileList[0]?.name,
        contentType: fileList[0]?.type,
      }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": token
        }
      });

      // 2. Upload image to S3
      await axios.post(presignedUrlResponse.data.result.url, fileList[0])

      // 3. Index product metadata
      const productData = {
        title: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        color: formData.color,
        file_name: presignedUrlResponse.data.result.key.split('/')[1]
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
        color: ''
      });
    } catch (err) {
      setError('Failed to upload product. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Container header={<Header variant="h1">Upload New Product</Header>}>
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
  );
} 