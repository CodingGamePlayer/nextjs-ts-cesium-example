import CesiumComponent from "../Components/CesiumComponent";
import CesiumWrapper from "../Components/CesiumWrapper";

async function getPosition() {
  //Mimic server-side stuff...
  return {
    position: {
      lat: 39.953436,
      lng: -75.164356,
    },
  };
}

export default async function MainPage() {
  const fetchedPosition = await getPosition();
  return (
    <CesiumWrapper>
      <CesiumComponent positions={[fetchedPosition.position]} />
    </CesiumWrapper>
  );
}
