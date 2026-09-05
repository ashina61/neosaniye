import { Composition } from "remotion";
import { Scene, calculateMetadata, SceneProps } from "./Composition";

export const Root: React.FC = () => (
  <Composition
    id="TheDigitThatCatchesLiars"
    component={Scene}
    durationInFrames={1698}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ shots: [], captions: [] } as SceneProps}
    calculateMetadata={calculateMetadata}
  />
);
