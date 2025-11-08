import { useState } from "react";
import { LinkBlock } from "./LinkBlock";

type Props = {
  // fetchLinks: (quizId: string)=>Promise<string[]>;
  // fetchName: (linkId: string)=>Promise<string>;
  isloading: boolean;
  links: {
    linkId: string;
    linkName: string;
  }[];
};
export const LinkBox = ({ isloading, links }: Props) => {
  if (isloading) {
    return <div>loading</div>;
  }

  return (
    <div>
      {links.map((link, index) => (
        <LinkBlock
          key={link.linkId}
          linkId={link.linkId}
          linkName={link.linkName}
          index={index}
        />
      ))}
    </div>
  );
};
