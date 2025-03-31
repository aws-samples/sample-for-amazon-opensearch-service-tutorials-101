import { HelpPanel, Icon } from "@cloudscape-design/components";
import { HelpPage } from "../common/types";
import config from "../help-properties.json";
import DOMPurify from 'dompurify';

export default function Help(props: HelpPage) {
    const getDescription = () => {
        const content = config[props.setPageId]?.description || "";
        return DOMPurify.sanitize(content, {
            // You can configure allowed tags/attributes if needed
            ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'li', 'br'],
            ALLOWED_ATTR: ['href', 'target']
        });
    };

    return (
        <HelpPanel
            header={<h2>{(config[props.setPageId])?config[props.setPageId].title: ""}</h2>}
        >
            <div dangerouslySetInnerHTML={{__html: getDescription()}}>
            </div>
        </HelpPanel>
    );
}
