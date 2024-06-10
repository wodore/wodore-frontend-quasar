<script setup lang="ts">
defineOptions({
  name: 'ErrorNotFound',
});
</script>

<template>
  <div class="bg-dark fullscreen">
    <q-card
      class="bg-primary dialog-radius text-white text-left scroll q-ma-xl shadow-4"
      style="max-width: 880px; height: calc(100% - 100px)"
    >
      <q-scroll-area style="height: 101%" class="q-px-md">
        <h5 class="text-accent">Datenschutzerklärung für Wodore</h5>

        <p><strong>Zuletzt aktualisiert:</strong> 10. Juni 2024</p>

        <h6>Zusammenfassung</h6>
        <div class="text-body2">
          <p>
            <strong>Datenverarbeitung:</strong> Wir verwenden essentielle
            Cookies und verfolgen anonyme Nutzungsdaten mit Umami, um die Seite
            zu verbessern.
          </p>

          <p>
            <strong>Datenweitergabe:</strong> Ihre Daten werden nicht an Dritte
            weitergegeben.
          </p>

          <p>
            <strong>Dienstleister:</strong> Wir verwenden Cloudinary für das
            Hosting von Bildern, Informaniak für Cloud-Dienste, Zitadel für das
            Benutzermanagement (selbst gehostet) und Stripe für die
            Zahlungsabwicklung.
          </p>

          <p>
            <strong>Benutzerrechte:</strong> Sie haben das Recht, Ihre Daten auf
            Anfrage zuzugreifen, zu korrigieren und zu löschen.
          </p>

          <p>
            Für weitere Details lesen Sie bitte die vollständige Richtlinie
            unten.
          </p>
        </div>

        <hr class="q-my-xl" />
        <div class="text-body3">
          <p>
            Willkommen bei Wodore! Wir verpflichten uns, Ihre Privatsphäre zu
            schützen und sicherzustellen, dass Ihre persönlichen Informationen
            sicher und verantwortungsbewusst behandelt werden. Diese
            Datenschutzerklärung erläutert, wie wir Informationen sammeln,
            verwenden und schützen, wenn Sie unsere Website
            <a href="https://wodore.com">wodore.com</a> (die "Seite") besuchen.
          </p>

          <h6>1. Definitionen</h6>
          <ul>
            <li>
              <strong>Personenbezogene Daten:</strong> Alle Informationen, die
              sich auf eine identifizierte oder identifizierbare Person
              beziehen.
            </li>
            <li>
              <strong>Cookies:</strong> Kleine Dateien, die auf Ihrem Gerät
              gespeichert werden und dazu dienen, Ihre Erfahrung auf unserer
              Seite zu verbessern.
            </li>
            <li>
              <strong>Dienstleister:</strong> Drittunternehmen, die wir zur
              Unterstützung unserer Dienste nutzen.
            </li>
          </ul>

          <h6>2. Informationen, die wir sammeln</h6>
          <p>
            <strong>Cookies:</strong> Wir verwenden nur essentielle Cookies, um
            die ordnungsgemäße Funktion unserer Website zu gewährleisten. Diese
            Cookies sind notwendig für den Betrieb der Website und können in
            unseren Systemen nicht deaktiviert werden.
          </p>

          <p>
            <strong>Tracking:</strong> Wir verwenden
            <a href="https://umami.is/">Umami</a> zu Verfolgungszwecken. Diese
            Verfolgung ist intern, anonym und dient ausschließlich der
            Verbesserung der Seite. Umami stellt die Anonymität sicher, indem
            keine personenbezogenen Daten (PII) gesammelt werden. Es werden
            Daten wie Seitenaufrufe, Referrer, Browsertypen, Betriebssysteme,
            Gerätetypen, Bildschirmgrößen, aufgerufene URLs und Verweildauer auf
            der Seite verfolgt. Diese Daten werden in aggregierter Form
            analysiert, um die Leistung und Benutzererfahrung der Website zu
            verbessern, ohne die Privatsphäre des Einzelnen zu beeinträchtigen.
          </p>

          <h6>3. Verwendung der Informationen</h6>
          <p>
            Die von uns gesammelten Informationen werden ausschließlich dazu
            verwendet, Ihre Erfahrung auf unserer Website zu verbessern. Wir
            geben Ihre Daten nicht an Dritte weiter, außer wenn dies zur
            Verwaltung und Verbesserung unserer Website und Dienste erforderlich
            ist.
          </p>

          <h6>4. Dienstleister</h6>
          <p>
            Zur Bereitstellung unserer Dienste verwenden wir die folgenden
            Dienstleister:
          </p>
          <ul>
            <li>
              <strong>Cloudinary:</strong> Verwendet für
              <a href="https://cloudinary.com/"
                >Bildhosting und -bereitstellung</a
              >.
            </li>
            <li>
              <strong>Informaniak:</strong> Cloud-Service-Provider, der für
              <a href="https://www.infomaniak.com/"
                >Hosting und andere Dienste</a
              >
              verwendet wird.
            </li>
            <li>
              <strong>Zitadel:</strong> Wir verwenden
              <a href="https://zitadel.com/">Zitadel</a> für das
              Benutzermanagement, das selbst gehostet wird.
            </li>
            <li>
              <strong>Stripe:</strong> Verwendet für
              <a href="https://stripe.com/">Zahlungsabwicklung</a>.
            </li>
          </ul>

          <h6>5. Datenzugriff, Korrektur und Löschung</h6>
          <p>
            Sie haben das Recht, auf Ihre Daten zuzugreifen, sie zu korrigieren
            und zu löschen. Wenn Sie diese Rechte ausüben möchten, kontaktieren
            Sie uns bitte unter
            <a href="mailto:tb@wodore.com">tb@wodore.com</a>. Wir werden Ihre
            Anfrage innerhalb eines angemessenen Zeitrahmens beantworten.
          </p>

          <h6>6. Datensicherheit</h6>
          <p>
            Wir nehmen die Sicherheit Ihrer Daten ernst und implementieren
            geeignete technische und organisatorische Maßnahmen, um sie vor
            unbefugtem Zugriff, Offenlegung, Veränderung oder Zerstörung zu
            schützen.
          </p>

          <h6>7. Aktualisierungen dieser Richtlinie</h6>
          <p>
            Wir können diese Datenschutzerklärung von Zeit zu Zeit
            aktualisieren, um Änderungen unserer Praktiken oder geltenden
            Gesetze widerzuspiegeln. Wenn wir Änderungen vornehmen, werden wir
            das Datum "Zuletzt aktualisiert" oben auf dieser Seite anpassen. Wir
            empfehlen Ihnen, diese Richtlinie regelmäßig zu überprüfen, um
            informiert zu bleiben, wie wir Ihre Informationen schützen.
          </p>

          <h6>8. Kontaktieren Sie uns</h6>
          <p>
            Wenn Sie Fragen oder Bedenken bezüglich dieser Datenschutzerklärung
            haben, kontaktieren Sie uns bitte unter:
          </p>
          <p>Email: <a href="mailto:tb@wodore.com">tb@wodore.com</a></p>

          <p class="q-pb-xl q-mt-lg text-body1">
            Vielen Dank, dass Sie Wodore Ihre Informationen anvertrauen. Wir
            sind bestrebt, Ihre Privatsphäre und Sicherheit zu gewährleisten.
          </p>
        </div>
      </q-scroll-area>
    </q-card>
  </div>
</template>
