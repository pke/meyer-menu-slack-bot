const EMPLOYEES = [ 
  { name: "Sven Lackinger", customerId: "335508", pin: "3258" },
  { name: "Marik Hermann", customerId: "335509", pin: "3124" },
  { name: "Maximilian Messing", customerId: "335510", pin: "3365" },
  { name: "Tobias Weiper", customerId: "335511", pin: "1144" },
  { name: "Marcus Ilgner", customerId: "335512", pin: "1773" },
  { name: "Andreas Sliwka", customerId: "335513", pin: "8534" },
  { name: "Daniel Arcularius", customerId: "335514", pin: "6743" },
  { name: "Philipp Kursawe", customerId: "335515", pin: "3437" },
  { name: "Andreas Wagner", customerId: "335516", pin: "3638" },
  { name: "Martin Storch", customerId: "335518", pin: "6728" },
  { name: "Philipp Schnorbach", customerId: "335520", pin: "5318" },
  { name: "Florian Teller", customerId: "335521", pin: "3456" },
  { name: "Friedrich Idschok", customerId: "335522", pin: "3683" },
  { name: "Jan Frammelsberger", customerId: "335523", pin: "7771" },
  { name: "Juwel Jetter", customerId: "335524", pin: "4762" },
  { name: "Nora Flohr", customerId: "335526", pin: "6278" },
  { name: "Uzair Anwar", customerId: "335527", pin: "4712" },
  { name: "Jan Schmidt", customerId: "335528", pin: "6517" },
  { name: "Tino Becker", customerId: "335529", pin: "9222" },
  { name: "Osman Perviz", customerId: "335530", pin: "9753" } 
].sort(function(a,b) { return a.name.localeCompare(b.name) })


module.export = {
  EMPLOYEES 
}