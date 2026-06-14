import { useState, useEffect } from "react";
import api from "@/lib/api";
import type { Pet } from "@/types";

export function usePets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Pet[] }>("/pets/my")
      .then(({ data }) => setPets(data.data))
      .catch(() => setError("Failed to load pets"))
      .finally(() => setLoading(false));
  }, []);

  return { pets, loading, error };
}
