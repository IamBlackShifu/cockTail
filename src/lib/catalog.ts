export type Cocktail = { id: number; name: string; note: string; price: number; category: string; image: string; strength: string; tone: string; available?: boolean; featured?: boolean; displayOrder?: number };
export type ManagedProduct = Cocktail & { priceCents: number; active: boolean; available: boolean; featured: boolean; displayOrder: number; version: number; createdAt: string; updatedAt: string };
export type CustomOption = { label: string; price: number };
export const cocktails: Cocktail[] = [
  { id: 1, name: "Mango Heatwave", note: "Mango · chilli · lime", price: 13, category: "Fruity", image: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=900&q=85", strength: "Medium", tone: "sunset" },
  { id: 2, name: "Velvet Negroni", note: "Gin · vermouth · orange", price: 15, category: "Strong", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=85", strength: "Strong", tone: "ruby" },
  { id: 3, name: "Cucumber Gimlet", note: "Gin · cucumber · basil", price: 12, category: "Low Alcohol", image: "https://images.unsplash.com/photo-1629203849820-fdd70d49c38e?auto=format&fit=crop&w=900&q=85", strength: "Light", tone: "mint" },
  { id: 4, name: "Pink Paloma", note: "Tequila · grapefruit · sea salt", price: 14, category: "Sour", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=85", strength: "Medium", tone: "pink" },
  { id: 5, name: "Midnight Mule", note: "Vodka · ginger · blackberry", price: 13, category: "Signature", image: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=900&q=85", strength: "Medium", tone: "violet" },
  { id: 6, name: "Garden Spritz", note: "Elderflower · prosecco · mint", price: 11, category: "Classic", image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=85", strength: "Light", tone: "lime" },
];
export const productTones = ["sunset", "ruby", "mint", "pink", "violet", "lime"] as const;
export const categories = ["All sips", "Signature", "Classic", "Fruity", "Sour", "Strong", "Low Alcohol", "Mocktails"];
export const options = { spirit: [{ label: "Vodka", price: 0 }, { label: "Gin", price: 1 }, { label: "Tequila", price: 1 }, { label: "Rum", price: 0 }], mixer: [{ label: "Passionfruit", price: 1 }, { label: "Tonic water", price: 0 }, { label: "Ginger beer", price: 1 }, { label: "Soda", price: 0 }], finish: [{ label: "Lime & mint", price: 0 }, { label: "Chilli salt", price: 1 }, { label: "Berry crown", price: 2 }] };
export const customizationGroups: { key: keyof Customization; label: string; options: CustomOption[] }[] = [
  { key: "size", label: "Choose your size", options: [{ label: "Classic", price: 0 }, { label: "Large cup", price: 3 }] },
  { key: "sweetness", label: "Sweetness", options: [{ label: "No sugar", price: 0 }, { label: "Low", price: 0 }, { label: "Normal", price: 0 }, { label: "Extra sweet", price: 0 }] },
  { key: "strength", label: "Alcohol strength", options: [{ label: "Light", price: 0 }, { label: "Standard", price: 0 }, { label: "Extra shot", price: 3 }] },
  { key: "ice", label: "Ice", options: [{ label: "No ice", price: 0 }, { label: "Normal ice", price: 0 }, { label: "Extra ice", price: 0 }, { label: "Crushed ice", price: 1 }] },
  { key: "garnish", label: "Garnish", options: [{ label: "No garnish", price: 0 }, { label: "Lime & mint", price: 0 }, { label: "Berries", price: 2 }, { label: "Cocktail cherry", price: 1 }] },
  { key: "extra", label: "Add something extra", options: [{ label: "Nothing extra", price: 0 }, { label: "Energy drink", price: 2 }, { label: "Premium spirit", price: 4 }, { label: "Snack pairing", price: 5 }] },
];
export type Customization = { size: CustomOption; sweetness: CustomOption; strength: CustomOption; ice: CustomOption; garnish: CustomOption; extra: CustomOption };
export const defaultCustomization: Customization = { size: customizationGroups[0].options[0], sweetness: customizationGroups[1].options[2], strength: customizationGroups[2].options[1], ice: customizationGroups[3].options[1], garnish: customizationGroups[4].options[1], extra: customizationGroups[5].options[0] };

