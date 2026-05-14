export abstract class AbstractPresenter<Model, Response> {
  abstract present(model: Model): Response;

  presentWithoutRelations(model: Model): Response {
    return this.present(model);
  }

  presentMany(models: Model[]): Response[] {
    return models.map((model) => this.present(model));
  }
}
