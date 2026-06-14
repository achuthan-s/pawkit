import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Pet } from "@/types";

interface PetCardProps {
  pet: Pet;
}

export default function PetCard({ pet }: PetCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{pet.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>Species: {pet.species}</p>
        {pet.breed && <p>Breed: {pet.breed}</p>}
        <p>Age: {pet.age} year{pet.age !== 1 ? "s" : ""}</p>
      </CardContent>
    </Card>
  );
}
